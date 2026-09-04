package controllers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"
	"xar-backend-go/internal/config"

	"github.com/gofiber/fiber/v2"
)

var (
	courierCacheLock sync.RWMutex
	cachedCouriers   []interface{}
	cachedCouriersTS time.Time

	areaCacheLock sync.RWMutex
	areaCacheMap  = make(map[string][]interface{})
)

var fallbackCouriers = []map[string]string{
	{"code": "jne", "name": "JNE"},
	{"code": "jnt", "name": "J&T Express"},
	{"code": "sicepat", "name": "SiCepat"},
	{"code": "anteraja", "name": "AnterAja"},
	{"code": "ninja", "name": "Ninja Xpress"},
	{"code": "pos", "name": "POS Indonesia"},
	{"code": "tiki", "name": "TIKI"},
	{"code": "wahana", "name": "Wahana"},
	{"code": "lion", "name": "Lion Parcel"},
	{"code": "ide", "name": "ID Express"},
	{"code": "sap", "name": "SAP Express"},
	{"code": "rpx", "name": "RPX"},
}

func getBiteshipKey() string {
	isProduction := false
	if config.DB != nil {
		var isProd sql.NullBool
		_ = config.DB.QueryRow("SELECT biteship_is_production FROM store_config WHERE id = 'main' LIMIT 1").Scan(&isProd)
		if isProd.Valid {
			isProduction = isProd.Bool
		}
	}

	if isProduction {
		return os.Getenv("BITESHIP_API_KEY_PRODUCTION")
	}
	return os.Getenv("BITESHIP_API_KEY_SANDBOX")
}

// GetBiteshipAreas proxies search to Biteship Maps Areas API
func GetBiteshipAreas(c *fiber.Ctx) error {
	query := strings.TrimSpace(c.Query("q"))
	postalCode := strings.TrimSpace(c.Query("postalCode"))

	if len(query) < 2 {
		return c.JSON(fiber.Map{"areas": []interface{}{}})
	}

	cacheKey := fmt.Sprintf("%s_%s", strings.ToLower(query), postalCode)
	areaCacheLock.RLock()
	if cached, ok := areaCacheMap[cacheKey]; ok {
		areaCacheLock.RUnlock()
		return c.JSON(fiber.Map{"areas": cached})
	}
	areaCacheLock.RUnlock()

	apiKey := getBiteshipKey()
	if apiKey == "" {
		return c.JSON(fiber.Map{"areas": []interface{}{}, "error": "Biteship API key belum diatur."})
	}

	searchInput := query
	if postalCode != "" && !strings.Contains(query, postalCode) {
		searchInput = fmt.Sprintf("%s %s", query, postalCode)
	}

	targetURL := fmt.Sprintf(
		"https://api.biteship.com/v1/maps/areas?countries=ID&input=%s&type=single",
		url.QueryEscape(searchInput),
	)

	req, err := http.NewRequest("GET", targetURL, nil)
	if err != nil {
		return c.JSON(fiber.Map{"areas": []interface{}{}})
	}
	req.Header.Set("Authorization", apiKey)

	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Do(req)
	if err != nil || resp.StatusCode != http.StatusOK {
		return c.JSON(fiber.Map{"areas": []interface{}{}})
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)
	var result struct {
		Areas []interface{} `json:"areas"`
	}

	if err := json.Unmarshal(bodyBytes, &result); err == nil && result.Areas != nil {
		areaCacheLock.Lock()
		areaCacheMap[cacheKey] = result.Areas
		areaCacheLock.Unlock()

		return c.JSON(fiber.Map{"areas": result.Areas})
	}

	return c.JSON(fiber.Map{"areas": []interface{}{}})
}

// GetBiteshipCouriers retrieves active couriers from Biteship
func GetBiteshipCouriers(c *fiber.Ctx) error {
	courierCacheLock.RLock()
	if len(cachedCouriers) > 0 && time.Since(cachedCouriersTS) < time.Hour {
		couriers := cachedCouriers
		courierCacheLock.RUnlock()
		return c.JSON(fiber.Map{"couriers": couriers})
	}
	courierCacheLock.RUnlock()

	apiKey := getBiteshipKey()
	if apiKey == "" {
		return c.JSON(fiber.Map{"couriers": fallbackCouriers})
	}

	req, _ := http.NewRequest("GET", "https://api.biteship.com/v1/couriers", nil)
	req.Header.Set("Authorization", apiKey)

	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Do(req)
	if err != nil || resp.StatusCode != http.StatusOK {
		return c.JSON(fiber.Map{"couriers": fallbackCouriers})
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)
	var result struct {
		Couriers []struct {
			CourierCode string `json:"courier_code"`
			CourierName string `json:"courier_name"`
		} `json:"couriers"`
	}

	if err := json.Unmarshal(bodyBytes, &result); err == nil && len(result.Couriers) > 0 {
		var uniqueCouriers []interface{}
		seen := make(map[string]bool)

		for _, cInfo := range result.Couriers {
			if !seen[cInfo.CourierCode] {
				seen[cInfo.CourierCode] = true
				uniqueCouriers = append(uniqueCouriers, map[string]string{
					"code": cInfo.CourierCode,
					"name": cInfo.CourierName,
				})
			}
		}

		courierCacheLock.Lock()
		cachedCouriers = uniqueCouriers
		cachedCouriersTS = time.Now()
		courierCacheLock.Unlock()

		return c.JSON(fiber.Map{"couriers": uniqueCouriers})
	}

	return c.JSON(fiber.Map{"couriers": fallbackCouriers})
}

// CreateBiteshipOrder creates a courier pickup order via Biteship API
func CreateBiteshipOrder(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	var req map[string]interface{}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	orderID, _ := req["order_id"].(string)
	if orderID == "" {
		orderID, _ = req["orderId"].(string)
	}

	apiKey := getBiteshipKey()
	if apiKey == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Biteship API key is not configured in settings or environment."})
	}

	biteshipPayload := make(map[string]interface{})
	for k, v := range req {
		biteshipPayload[k] = v
	}

	// If orderID is provided, automatically load missing fields from DB
	if orderID != "" {
		var (
			orderNumber, custName, custEmail, custPhone sql.NullString
			shippingAddressJSON, shippingDetailJSON, itemsJSON []byte
			totalAmount float64
		)

		err := config.DB.QueryRow(`
			SELECT order_number, customer_name, customer_email, customer_phone,
			       shipping_address, shipping_detail, items, total_amount
			FROM orders
			WHERE id::text = $1 OR order_number = $1
			LIMIT 1
		`, orderID).Scan(
			&orderNumber, &custName, &custEmail, &custPhone,
			&shippingAddressJSON, &shippingDetailJSON, &itemsJSON, &totalAmount,
		)

		if err == nil {
			var shipAddr map[string]interface{}
			_ = json.Unmarshal(shippingAddressJSON, &shipAddr)

			var shipDetail map[string]interface{}
			_ = json.Unmarshal(shippingDetailJSON, &shipDetail)

			var itemsList []map[string]interface{}
			_ = json.Unmarshal(itemsJSON, &itemsList)

			// Store origin
			originName := "Toko Mameko"
			originPhone := "081234567890"
			originAddress := "Yogyakarta, Indonesia"
			originPostalCode := "55281"
			originAreaID := ""
			
			var storeName, storeEmail, storeCityName, storeCityId sql.NullString
			_ = config.DB.QueryRow(`SELECT store_name, store_email, store_city_name, store_city_id FROM store_config WHERE id = 'main' LIMIT 1`).Scan(&storeName, &storeEmail, &storeCityName, &storeCityId)
			if storeName.Valid && storeName.String != "" {
				originName = storeName.String
			}
			if storeCityName.Valid && storeCityName.String != "" {
				originAddress = storeCityName.String
				// Extract postal code from the end if possible, e.g. "Ngemplak... 55584"
				parts := strings.Split(storeCityName.String, " ")
				if len(parts) > 0 {
					lastPart := parts[len(parts)-1]
					if len(lastPart) == 5 {
						originPostalCode = lastPart
					}
				}
			}
			if storeCityId.Valid && storeCityId.String != "" {
				originAreaID = storeCityId.String
			}

			destName := custName.String
			if rName, ok := shipAddr["recipientName"].(string); ok && rName != "" {
				destName = rName
			}
			destPhone := custPhone.String
			if rPhone, ok := shipAddr["recipientPhone"].(string); ok && rPhone != "" {
				destPhone = rPhone
			}
			if destPhone == "" {
				destPhone = "08123456789"
			}

			destPostalCode := ""
			if pCode, ok := shipAddr["postalCode"].(string); ok {
				destPostalCode = pCode
			}

			var destAddressParts []string
			if st, ok := shipAddr["street"].(string); ok && st != "" {
				destAddressParts = append(destAddressParts, st)
			}
			if dist, ok := shipAddr["district"].(string); ok && dist != "" {
				destAddressParts = append(destAddressParts, "Kec. "+dist)
			}
			if ct, ok := shipAddr["city"].(string); ok && ct != "" {
				destAddressParts = append(destAddressParts, ct)
			}
			if prov, ok := shipAddr["province"].(string); ok && prov != "" {
				destAddressParts = append(destAddressParts, prov)
			}
			destAddress := strings.Join(destAddressParts, ", ")
			if destAddress == "" {
				if full, ok := shipAddr["fullAddress"].(string); ok && full != "" {
					destAddress = full
				} else {
					destAddress = "Indonesia"
				}
			}

			destAreaID := ""
			if aID, ok := shipAddr["biteshipAreaId"].(string); ok {
				destAreaID = aID
			}

			// Courier company & service
			courierCompany := "jne"
			if cComp, ok := shipDetail["courier"].(string); ok && cComp != "" {
				courierCompany = strings.ToLower(cComp)
			} else if cName, ok := shipDetail["courierName"].(string); ok && cName != "" {
				courierCompany = strings.ToLower(cName)
			}
			// Clean up courier company
			if strings.Contains(courierCompany, "j&t") || strings.Contains(courierCompany, "jnt") {
				courierCompany = "jnt"
			} else if strings.Contains(courierCompany, "sicepat") {
				courierCompany = "sicepat"
			} else if strings.Contains(courierCompany, "anteraja") {
				courierCompany = "anteraja"
			} else if strings.Contains(courierCompany, "ninja") {
				courierCompany = "ninja"
			} else if strings.Contains(courierCompany, "tiki") {
				courierCompany = "tiki"
			} else if strings.Contains(courierCompany, "pos") {
				courierCompany = "pos"
			} else if strings.Contains(courierCompany, "jne") {
				courierCompany = "jne"
			}

			courierType := "reg"
			if cSvc, ok := shipDetail["courierService"].(string); ok && cSvc != "" {
				courierType = strings.ToLower(cSvc)
			} else if cSvc, ok := shipDetail["service_type"].(string); ok && cSvc != "" {
				courierType = strings.ToLower(cSvc)
			} else if cSvc, ok := shipDetail["service"].(string); ok && cSvc != "" {
				courierType = strings.ToLower(cSvc)
			} else if cSvc, ok := shipDetail["courier_service"].(string); ok && cSvc != "" {
				courierType = strings.ToLower(cSvc)
			}
			courierType = normalizeCourierType(courierCompany, courierType)

			var biteshipItems []map[string]interface{}
			for _, it := range itemsList {
				iName := "Produk"
				if n, ok := it["name"].(string); ok && n != "" {
					iName = n
				} else if n, ok := it["product_name"].(string); ok && n != "" {
					iName = n
				}
				iVal := 10000
				if v, ok := it["price"].(float64); ok && v > 0 {
					iVal = int(v)
				}
				iQty := 1
				if q, ok := it["quantity"].(float64); ok && q > 0 {
					iQty = int(q)
				}
				iWeight := 250
				if w, ok := it["weight"].(float64); ok && w > 0 {
					iWeight = int(w)
				}
				biteshipItems = append(biteshipItems, map[string]interface{}{
					"name":     iName,
					"value":    iVal,
					"quantity": iQty,
					"weight":   iWeight,
				})
			}
			if len(biteshipItems) == 0 {
				biteshipItems = append(biteshipItems, map[string]interface{}{
					"name":     fmt.Sprintf("Order %s", orderNumber.String),
					"value":    int(totalAmount),
					"quantity": 1,
					"weight":   250,
				})
			}

			if biteshipPayload["origin_contact_name"] == nil {
				biteshipPayload["origin_contact_name"] = originName
			}
			if biteshipPayload["origin_contact_phone"] == nil {
				biteshipPayload["origin_contact_phone"] = originPhone
			}
			if biteshipPayload["origin_address"] == nil {
				biteshipPayload["origin_address"] = originAddress
			}
			if biteshipPayload["origin_postal_code"] == nil {
				biteshipPayload["origin_postal_code"] = originPostalCode
			}
			if biteshipPayload["origin_area_id"] == nil && originAreaID != "" {
				biteshipPayload["origin_area_id"] = originAreaID
			}
			if biteshipPayload["destination_contact_name"] == nil {
				biteshipPayload["destination_contact_name"] = destName
			}
			if biteshipPayload["destination_contact_phone"] == nil {
				biteshipPayload["destination_contact_phone"] = destPhone
			}
			if biteshipPayload["destination_address"] == nil {
				biteshipPayload["destination_address"] = destAddress
			}
			if biteshipPayload["destination_postal_code"] == nil && destPostalCode != "" {
				biteshipPayload["destination_postal_code"] = destPostalCode
			}
			if biteshipPayload["destination_area_id"] == nil && destAreaID != "" {
				biteshipPayload["destination_area_id"] = destAreaID
			}
			if biteshipPayload["courier_company"] == nil {
				biteshipPayload["courier_company"] = courierCompany
			}
			if biteshipPayload["courier_type"] == nil {
				biteshipPayload["courier_type"] = courierType
			}
			if biteshipPayload["delivery_type"] == nil {
				biteshipPayload["delivery_type"] = "now"
			}
			if biteshipPayload["items"] == nil {
				biteshipPayload["items"] = biteshipItems
			}
		}
	}

	reqBytes, _ := json.Marshal(biteshipPayload)
	httpReq, err := http.NewRequest("POST", "https://api.biteship.com/v1/orders", strings.NewReader(string(reqBytes)))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	httpReq.Header.Set("Authorization", apiKey)
	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)
	var biteshipResp map[string]interface{}
	_ = json.Unmarshal(bodyBytes, &biteshipResp)

	// If Biteship returns an error, format error nicely
	if resp.StatusCode >= 400 || (biteshipResp["success"] != nil && biteshipResp["success"] == false) {
		errMsg := "Gagal request pickup ke Biteship"
		if errVal, ok := biteshipResp["error"].(string); ok && errVal != "" {
			errMsg = errVal
		} else if msgVal, ok := biteshipResp["message"].(string); ok && msgVal != "" {
			errMsg = msgVal
		}
		return c.Status(resp.StatusCode).JSON(fiber.Map{
			"success": false,
			"error":   errMsg,
			"details": biteshipResp,
		})
	}

	bID, _ := biteshipResp["id"].(string)
	waybill, _ := biteshipResp["waybill_id"].(string)
	trackingLink, _ := biteshipResp["courier_tracking_link"].(string)

	if courierMap, ok := biteshipResp["courier"].(map[string]interface{}); ok {
		if w, ok := courierMap["waybill_id"].(string); ok && w != "" && waybill == "" {
			waybill = w
		}
		if w, ok := courierMap["tracking_id"].(string); ok && w != "" && waybill == "" {
			waybill = w
		}
		if l, ok := courierMap["link"].(string); ok && l != "" && trackingLink == "" {
			trackingLink = l
		}
	}

	if bID != "" && orderID != "" {
		_, _ = config.DB.Exec(`
			UPDATE orders SET
				biteship_order_id = $1,
				waybill_id = COALESCE(NULLIF($2, ''), waybill_id),
				shipping_receipt_number = COALESCE(NULLIF($2, ''), shipping_receipt_number),
				courier_tracking_link = COALESCE(NULLIF($3, ''), courier_tracking_link),
				shipping_detail = CASE 
					WHEN $2 <> '' THEN jsonb_set(
						jsonb_set(COALESCE(shipping_detail, '{}'::jsonb), '{tracking_number}', to_jsonb($2::text)),
						'{courier_tracking_link}',
						to_jsonb($3::text)
					)
					ELSE shipping_detail 
				END,
				status = 'shipped',
				updated_at = NOW()
			WHERE id::text = $4 OR order_number = $4
		`, bID, waybill, trackingLink, orderID)
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Pickup berhasil di-request dan resi telah keluar.",
		"data": fiber.Map{
			"biteshipOrderId": bID,
			"waybillId":       waybill,
			"trackingLink":    trackingLink,
		},
		"raw": biteshipResp,
	})
}

// AutoCreateBiteshipOrder automatically books pickup when an order is paid
func AutoCreateBiteshipOrder(orderID string) {
	if config.DB == nil || orderID == "" {
		return
	}

	apiKey := getBiteshipKey()
	if apiKey == "" {
		return
	}

	// Check if already booked
	var (
		existingBiteshipID, existingWaybill sql.NullString
		orderNumber, custName, custEmail, custPhone sql.NullString
		shippingAddressJSON, shippingDetailJSON, itemsJSON []byte
		totalAmount float64
	)

	err := config.DB.QueryRow(`
		SELECT biteship_order_id, waybill_id, order_number, customer_name, customer_email, customer_phone,
		       shipping_address, shipping_detail, items, total_amount
		FROM orders
		WHERE id::text = $1 OR order_number = $1
		LIMIT 1
	`, orderID).Scan(
		&existingBiteshipID, &existingWaybill, &orderNumber, &custName, &custEmail, &custPhone,
		&shippingAddressJSON, &shippingDetailJSON, &itemsJSON, &totalAmount,
	)

	if err != nil || (existingBiteshipID.Valid && existingBiteshipID.String != "") {
		return // Already booked or not found
	}

	var shipAddr map[string]interface{}
	_ = json.Unmarshal(shippingAddressJSON, &shipAddr)

	var shipDetail map[string]interface{}
	_ = json.Unmarshal(shippingDetailJSON, &shipDetail)

	var itemsList []map[string]interface{}
	_ = json.Unmarshal(itemsJSON, &itemsList)

	// Store origin
	originName := "Toko Mameko"
	originPhone := "081234567890"
	originAddress := "Yogyakarta, Indonesia"
	originPostalCode := "55281"
	var storeName, storeEmail, storeCityName sql.NullString
	_ = config.DB.QueryRow(`SELECT store_name, store_email, store_city_name FROM store_config WHERE id = 'main' LIMIT 1`).Scan(&storeName, &storeEmail, &storeCityName)
	if storeName.Valid && storeName.String != "" {
		originName = storeName.String
	}
	if storeCityName.Valid && storeCityName.String != "" {
		originAddress = storeCityName.String
	}

	destName := custName.String
	if rName, ok := shipAddr["recipientName"].(string); ok && rName != "" {
		destName = rName
	}
	destPhone := custPhone.String
	if rPhone, ok := shipAddr["recipientPhone"].(string); ok && rPhone != "" {
		destPhone = rPhone
	}
	if destPhone == "" {
		destPhone = "08123456789"
	}

	destPostalCode := ""
	if pCode, ok := shipAddr["postalCode"].(string); ok {
		destPostalCode = pCode
	} else if pCode, ok := shipAddr["postal_code"].(string); ok {
		destPostalCode = pCode
	}

	destAreaID := ""
	if aID, ok := shipAddr["biteshipAreaId"].(string); ok {
		destAreaID = aID
	} else if aID, ok := shipAddr["biteship_area_id"].(string); ok {
		destAreaID = aID
	}

	courierCompany := "jne"
	courierType := "reg"
	if cComp, ok := shipDetail["courier"].(string); ok && cComp != "" {
		courierCompany = strings.ToLower(cComp)
	} else if cComp, ok := shipDetail["courier_name"].(string); ok && cComp != "" {
		courierCompany = strings.ToLower(cComp)
	}
	if cType, ok := shipDetail["courierService"].(string); ok && cType != "" {
		courierType = strings.ToLower(cType)
	} else if cType, ok := shipDetail["service_type"].(string); ok && cType != "" {
		courierType = strings.ToLower(cType)
	} else if cType, ok := shipDetail["service"].(string); ok && cType != "" {
		courierType = strings.ToLower(cType)
	} else if cType, ok := shipDetail["courier_service"].(string); ok && cType != "" {
		courierType = strings.ToLower(cType)
	}
	courierType = normalizeCourierType(courierCompany, courierType)

	biteshipItems := make([]map[string]interface{}, 0)
	for _, it := range itemsList {
		name, _ := it["name"].(string)
		if name == "" {
			name, _ = it["product_name"].(string)
		}
		if name == "" {
			name = "Produk"
		}
		qty := 1
		if qVal, ok := it["quantity"].(float64); ok && qVal > 0 {
			qty = int(qVal)
		} else if qVal, ok := it["qty"].(float64); ok && qVal > 0 {
			qty = int(qVal)
		}
		price := float64(0)
		if pVal, ok := it["price"].(float64); ok {
			price = pVal
		}
		weight := 200
		if wVal, ok := it["weight"].(float64); ok && wVal > 0 {
			weight = int(wVal)
		}
		biteshipItems = append(biteshipItems, map[string]interface{}{
			"name":     name,
			"quantity": qty,
			"value":    int(price),
			"weight":   weight,
		})
	}
	if len(biteshipItems) == 0 {
		biteshipItems = append(biteshipItems, map[string]interface{}{
			"name":     "Produk",
			"quantity": 1,
			"value":    int(totalAmount),
			"weight":   200,
		})
	}

	destAddress := ""
	if addr, ok := shipAddr["street"].(string); ok && addr != "" {
		destAddress = addr
	} else if addr, ok := shipAddr["address"].(string); ok && addr != "" {
		destAddress = addr
	}

	biteshipPayload := map[string]interface{}{
		"origin_contact_name":      originName,
		"origin_contact_phone":     originPhone,
		"origin_address":           originAddress,
		"origin_postal_code":       originPostalCode,
		"destination_contact_name": destName,
		"destination_contact_phone": destPhone,
		"destination_address":      destAddress,
		"courier_company":          courierCompany,
		"courier_type":             courierType,
		"delivery_type":            "now",
		"items":                    biteshipItems,
	}
	if destPostalCode != "" {
		biteshipPayload["destination_postal_code"] = destPostalCode
	}
	if destAreaID != "" {
		biteshipPayload["destination_area_id"] = destAreaID
	}

	reqBytes, _ := json.Marshal(biteshipPayload)
	httpReq, err := http.NewRequest("POST", "https://api.biteship.com/v1/orders", strings.NewReader(string(reqBytes)))
	if err != nil {
		return
	}
	httpReq.Header.Set("Authorization", apiKey)
	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)
	var biteshipResp map[string]interface{}
	_ = json.Unmarshal(bodyBytes, &biteshipResp)

	bID, _ := biteshipResp["id"].(string)
	waybill, _ := biteshipResp["waybill_id"].(string)
	trackingLink, _ := biteshipResp["courier_tracking_link"].(string)

	if courierMap, ok := biteshipResp["courier"].(map[string]interface{}); ok {
		if w, ok := courierMap["waybill_id"].(string); ok && w != "" && waybill == "" {
			waybill = w
		}
		if w, ok := courierMap["tracking_id"].(string); ok && w != "" && waybill == "" {
			waybill = w
		}
		if l, ok := courierMap["link"].(string); ok && l != "" && trackingLink == "" {
			trackingLink = l
		}
	}

	if bID != "" {
		_, _ = config.DB.Exec(`
			UPDATE orders SET
				biteship_order_id = $1,
				waybill_id = COALESCE(NULLIF($2, ''), waybill_id),
				shipping_receipt_number = COALESCE(NULLIF($2, ''), shipping_receipt_number),
				courier_tracking_link = COALESCE(NULLIF($3, ''), courier_tracking_link),
				shipping_detail = CASE 
					WHEN $2 <> '' THEN jsonb_set(
						jsonb_set(COALESCE(shipping_detail, '{}'::jsonb), '{tracking_number}', to_jsonb($2::text)),
						'{courier_tracking_link}',
						to_jsonb($3::text)
					)
					ELSE shipping_detail 
				END,
				status = 'shipped',
				updated_at = NOW()
			WHERE id::text = $4 OR order_number = $4
		`, bID, waybill, trackingLink, orderID)
	}
}

func normalizeCourierType(company, svcType string) string {
	c := strings.ToLower(strings.TrimSpace(company))
	s := strings.ToLower(strings.TrimSpace(svcType))

	// Clean courier names to match Biteship's internal code keys
	if strings.Contains(c, "jnt") || strings.Contains(c, "j&t") { c = "jnt" }
	if strings.Contains(c, "sicepat") { c = "sicepat" }
	if strings.Contains(c, "anteraja") { c = "anteraja" }
	if strings.Contains(c, "pos") { c = "pos" }
	if strings.Contains(c, "ninja") { c = "ninja" }
	if strings.Contains(c, "lion") { c = "lion" }
	if strings.Contains(c, "ide") || strings.Contains(c, "id express") { c = "idexpress" }
	if strings.Contains(c, "sap") { c = "sap" }
	if strings.Contains(c, "wahana") { c = "wahana" }
	if strings.Contains(c, "rpx") { c = "rpx" }

	// Data semua layanan yang dimiliki Biteship
	validServices := map[string][]string{
		"gojek":        {"instant", "same_day"},
		"grab":         {"instant", "same_day", "instant_car"},
		"deliveree":    {"tronton_wing_box", "tronton_box", "fuso_heavy", "fuso_light", "cdd_box", "cdd_pickup", "cde_frozen", "cde_flammable", "cde_chemical", "engkel_box", "engkel_pickup", "small_box", "small_pickup", "van", "economy"},
		"jne":          {"reg", "yes", "oke", "jtr", "jtr_150_250", "jtr_150", "jtr_250"},
		"tiki":         {"eko", "sds", "reg", "ons", "t15", "t25", "t60", "trc"},
		"ninja":        {"standard"},
		"lion":         {"reg_pack", "big_pack"},
		"sicepat":      {"reg", "best", "gokil"},
		"sentralcargo": {"land_electronic", "land_non_electronic", "air_electronic", "air_non_electronic"},
		"jnt":          {"ez"},
		"idexpress":    {"reg_half_kilo", "reg", "idtruck"},
		"rpx":          {"sdp", "mdp", "ndp", "rgp", "pas", "ecp", "hwp"},
		"wahana":       {"deno"},
		"pos":          {"sameday", "nextday", "reg", "cargo"},
		"tlx":          {"international_standard"},
		"jntcargo":     {"ft"},
		"anteraja":     {"reg", "same_day"},
		"sap":          {"reg", "reg_half_kilo", "ods", "sds", "cargo"},
		"paxel":        {"small", "medium", "large", "paxel_big"},
		"borzo":        {"instant_bike", "instant_car"},
		"lalamove":     {"motorcycle", "mpv", "van", "truck", "cdd_bak", "cdd_box", "engkel_bak", "engkel_box"},
		"dash_express": {"same_day"},
	}

	// 1. Normalisasi string fallback dari API Ongkir / FrontEnd
	switch c {
	case "jnt":
		if s == "reguler" || s == "reg" { s = "ez" }
	case "sicepat":
		if s == "reguler" || s == "siunt" { s = "reg" }
	case "pos":
		if s == "posreg" || s == "reguler" || s == "pos" { s = "reg" }
	case "wahana":
		if s == "reguler" || s == "reg" { s = "deno" }
	case "lion":
		if s == "reguler" || s == "reg" { s = "reg_pack" }
	case "rpx":
		if s == "reguler" || s == "reg" { s = "rgp" }
	case "ninja":
		if s == "reguler" || s == "reg" { s = "standard" }
	case "jne", "tiki", "anteraja", "idexpress", "sap":
		if s == "reguler" { s = "reg" }
	}

	// 2. Validasi ketat terhadap array Biteship
	if allowed, ok := validServices[c]; ok {
		for _, valid := range allowed {
			if s == strings.ToLower(valid) {
				return s // Match perfectly
			}
		}
		// 3. Fallback jika string tidak cocok dengan data Biteship
		if len(allowed) > 0 {
			if c == "jnt" { return "ez" }
			if c == "ninja" { return "standard" }
			if c == "wahana" { return "deno" }
			if c == "lion" { return "reg_pack" }
			if c == "rpx" { return "rgp" }
			if c == "jntcargo" { return "ft" }
			for _, v := range allowed {
				if v == "reg" { return "reg" }
			}
			return allowed[0]
		}
	}

	// Generic fallback jika kurir sama sekali tidak terdaftar di Biteship list kita
	if s == "reguler" || s == "" {
		return "reg"
	}
	return s
}

// SyncBiteshipOrder syncs courier tracking history for an order
func SyncBiteshipOrder(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	orderID := strings.TrimSpace(c.Params("id"))
	if orderID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Order ID is required"})
	}

	var (
		biteshipID, waybillID sql.NullString
		currentStatus         string
		trackingHistBytes     []byte
		statusHistBytes       []byte
	)
	err := config.DB.QueryRow(`
		SELECT biteship_order_id, waybill_id, status, tracking_history, status_history
		FROM orders
		WHERE id::text = $1 OR order_number = $1
		LIMIT 1
	`, orderID).Scan(&biteshipID, &waybillID, &currentStatus, &trackingHistBytes, &statusHistBytes)

	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Order not found"})
	}

	var currentTrackingHist interface{} = []interface{}{}
	if len(trackingHistBytes) > 0 {
		_ = json.Unmarshal(trackingHistBytes, &currentTrackingHist)
	}

	var currentStatusHist interface{} = []interface{}{}
	if len(statusHistBytes) > 0 {
		_ = json.Unmarshal(statusHistBytes, &currentStatusHist)
	}

	apiKey := getBiteshipKey()
	if apiKey == "" {
		return c.JSON(fiber.Map{
			"success": true,
			"message": "Biteship API key belum diatur.",
			"data": fiber.Map{
				"status":          currentStatus,
				"trackingHistory": currentTrackingHist,
				"statusHistory":   currentStatusHist,
				"waybillId":       waybillID.String,
			},
		})
	}

	targetRef := biteshipID.String
	targetURL := ""
	if targetRef != "" {
		targetURL = fmt.Sprintf("https://api.biteship.com/v1/orders/%s", targetRef)
	} else if waybillID.Valid && waybillID.String != "" {
		targetURL = fmt.Sprintf("https://api.biteship.com/v1/trackings/%s", waybillID.String)
	}

	if targetURL == "" {
		return c.JSON(fiber.Map{
			"success": true,
			"message": "Pesanan belum memiliki ID Biteship atau nomor resi. Silakan lakukan Request Pickup terlebih dahulu.",
			"data": fiber.Map{
				"status":          currentStatus,
				"trackingHistory": currentTrackingHist,
				"statusHistory":   currentStatusHist,
				"waybillId":       waybillID.String,
			},
		})
	}

	httpReq, _ := http.NewRequest("GET", targetURL, nil)
	httpReq.Header.Set("Authorization", apiKey)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil || resp.StatusCode != http.StatusOK {
		return c.JSON(fiber.Map{
			"success": true,
			"message": "Gagal menghubungi Biteship, status lokal dipertahankan.",
			"data": fiber.Map{
				"status":          currentStatus,
				"trackingHistory": currentTrackingHist,
				"statusHistory":   currentStatusHist,
				"waybillId":       waybillID.String,
			},
		})
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)
	var result map[string]interface{}
	if err := json.Unmarshal(bodyBytes, &result); err != nil {
		return c.JSON(fiber.Map{
			"success": true,
			"message": "Format data Biteship tidak valid.",
			"data": fiber.Map{
				"status":          currentStatus,
				"trackingHistory": currentTrackingHist,
				"statusHistory":   currentStatusHist,
				"waybillId":       waybillID.String,
			},
		})
	}

	// Map Biteship status to store status
	rawStatus, _ := result["status"].(string)
	mappedStatus := currentStatus
	bStatus := strings.ToLower(rawStatus)
	if bStatus == "delivered" {
		mappedStatus = "delivered"
	} else if bStatus == "cancelled" || bStatus == "rejected" {
		mappedStatus = "cancelled"
	} else if bStatus == "picking_up" || bStatus == "picked" || bStatus == "dropping_off" || bStatus == "allocated" {
		mappedStatus = "shipped"
	}

	respWaybill, _ := result["waybill_id"].(string)
	trackingLink, _ := result["courier_tracking_link"].(string)

	if courierMap, ok := result["courier"].(map[string]interface{}); ok {
		if w, ok := courierMap["waybill_id"].(string); ok && w != "" && respWaybill == "" {
			respWaybill = w
		} else if w, ok := courierMap["tracking_id"].(string); ok && w != "" && respWaybill == "" {
			respWaybill = w
		}
		if l, ok := courierMap["link"].(string); ok && l != "" && trackingLink == "" {
			trackingLink = l
		}
	}

	if respWaybill == "" {
		respWaybill = waybillID.String
	}

	// Format tracking_history entries with structured timestamps and notes
	var formattedTracking []map[string]interface{}
	if rawHist, ok := result["history"].([]interface{}); ok && len(rawHist) > 0 {
		for _, item := range rawHist {
			if itemMap, ok := item.(map[string]interface{}); ok {
				hStatus, _ := itemMap["status"].(string)
				hNote, _ := itemMap["note"].(string)
				hUpdated, _ := itemMap["updated_at"].(string)
				if hUpdated == "" {
					hUpdated = time.Now().UTC().Format(time.RFC3339)
				}
				formattedTracking = append(formattedTracking, map[string]interface{}{
					"timestamp": hUpdated,
					"status":    hStatus,
					"event":     "order." + hStatus,
					"note":      hNote,
					"details":   itemMap,
				})
			}
		}
	}

	var hBytes []byte
	if len(formattedTracking) > 0 {
		hBytes, _ = json.Marshal(formattedTracking)
	} else {
		nowStr := time.Now().UTC().Format(time.RFC3339)
		fallbackEntry := []map[string]interface{}{
			{
				"timestamp": nowStr,
				"status":    rawStatus,
				"event":     "order." + rawStatus,
				"note":      fmt.Sprintf("Status kurir: %s", rawStatus),
				"details":   result,
			},
		}
		hBytes, _ = json.Marshal(fallbackEntry)
	}

	// Update order in DB
	_, _ = config.DB.Exec(`
		UPDATE orders SET
			status = $1,
			tracking_history = $2::jsonb,
			waybill_id = COALESCE(NULLIF($3, ''), waybill_id),
			shipping_receipt_number = COALESCE(NULLIF($3, ''), shipping_receipt_number),
			courier_tracking_link = COALESCE(NULLIF($4, ''), courier_tracking_link),
			shipping_detail = CASE 
				WHEN $3 <> '' THEN jsonb_set(
					jsonb_set(COALESCE(shipping_detail, '{}'::jsonb), '{tracking_number}', to_jsonb($3::text)),
					'{courier_tracking_link}',
					to_jsonb($4::text)
				)
				ELSE shipping_detail 
			END,
			updated_at = NOW()
		WHERE id::text = $5 OR order_number = $5
	`, mappedStatus, string(hBytes), respWaybill, trackingLink, orderID)

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Status pelacakan kurir berhasil disinkronkan.",
		"data": fiber.Map{
			"status":              mappedStatus,
			"trackingHistory":     formattedTracking,
			"statusHistory":       currentStatusHist,
			"waybillId":           respWaybill,
			"courierTrackingLink": trackingLink,
			"raw":                 result,
		},
	})
}

