package controllers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"
	"xar-backend-go/internal/config"
	"xar-backend-go/internal/middleware"
	"xar-backend-go/internal/models"
	"xar-backend-go/internal/services"

	"github.com/gofiber/fiber/v2"
)

func parseOrderItem(itMap map[string]interface{}) models.OrderItem {
	var it models.OrderItem
	if v, ok := itMap["id"].(string); ok {
		it.ID = v
	}
	if v, ok := itMap["order_id"].(string); ok {
		it.OrderID = v
	}
	if v, ok := itMap["product_id"].(string); ok {
		it.ProductID = v
	}
	if v, ok := itMap["product_name"].(string); ok && v != "" {
		it.ProductName = v
	} else if v, ok := itMap["name"].(string); ok && v != "" {
		it.ProductName = v
	}
	if v, ok := itMap["variant_name"].(string); ok && v != "" {
		it.VariantName = &v
	} else if v, ok := itMap["size"].(string); ok && v != "" {
		it.VariantName = &v
	}
	if v, ok := itMap["size"].(string); ok && v != "" {
		it.Size = &v
	} else if it.VariantName != nil {
		it.Size = it.VariantName
	}
	if v, ok := itMap["image_url"].(string); ok {
		it.ImageURL = &v
	}

	it.Quantity = 1
	if v, ok := itMap["quantity"]; ok && v != nil {
		if q, err := strconv.Atoi(fmt.Sprintf("%v", v)); err == nil && q > 0 {
			it.Quantity = q
		}
	} else if v, ok := itMap["qty"]; ok && v != nil {
		if q, err := strconv.Atoi(fmt.Sprintf("%v", v)); err == nil && q > 0 {
			it.Quantity = q
		}
	}

	// Price resolution
	if v, ok := itMap["price"]; ok && v != nil {
		if p, err := strconv.ParseFloat(fmt.Sprintf("%v", v), 64); err == nil && p > 0 {
			it.Price = p
			it.PriceAtPurchase = p
		}
	}
	if v, ok := itMap["price_at_purchase"]; ok && v != nil {
		if p, err := strconv.ParseFloat(fmt.Sprintf("%v", v), 64); err == nil && p > 0 {
			it.PriceAtPurchase = p
			if it.Price == 0 {
				it.Price = p
			}
		}
	}
	if v, ok := itMap["subtotal"]; ok && v != nil {
		if s, err := strconv.ParseFloat(fmt.Sprintf("%v", v), 64); err == nil && s > 0 {
			it.Subtotal = s
		}
	}

	if it.Subtotal == 0 && it.Price > 0 {
		it.Subtotal = it.Price * float64(it.Quantity)
	}
	if it.Price == 0 && it.Subtotal > 0 && it.Quantity > 0 {
		it.Price = it.Subtotal / float64(it.Quantity)
		it.PriceAtPurchase = it.Price
	}

	return it
}

func buildNormalizedShipping(o *models.Order) map[string]interface{} {
	shippingMap := make(map[string]interface{})
	if len(o.ShippingDetail) > 0 {
		_ = json.Unmarshal(o.ShippingDetail, &shippingMap)
	}
	if shippingMap == nil {
		shippingMap = make(map[string]interface{})
	}

	courierName := "-"
	if val, ok := shippingMap["courierName"].(string); ok && val != "" {
		courierName = val
	} else if val, ok := shippingMap["courier_name"].(string); ok && val != "" {
		courierName = val
	} else if o.CourierName != nil && *o.CourierName != "" {
		courierName = *o.CourierName
	}

	serviceType := "-"
	if val, ok := shippingMap["courierService"].(string); ok && val != "" {
		serviceType = val
	} else if val, ok := shippingMap["service_type"].(string); ok && val != "" {
		serviceType = val
	} else if o.CourierService != nil && *o.CourierService != "" {
		serviceType = *o.CourierService
	}

	etd := "-"
	if val, ok := shippingMap["courierEtd"].(string); ok && val != "" {
		etd = val
	} else if val, ok := shippingMap["etd"].(string); ok && val != "" {
		etd = val
	}

	trackingNumber := ""
	if o.WaybillID != nil && *o.WaybillID != "" {
		trackingNumber = *o.WaybillID
	} else if val, ok := shippingMap["tracking_number"].(string); ok && val != "" {
		trackingNumber = val
	} else if val, ok := shippingMap["trackingNumber"].(string); ok && val != "" {
		trackingNumber = val
	}

	trackingLink := ""
	if o.CourierTrackingLink != nil && *o.CourierTrackingLink != "" {
		trackingLink = *o.CourierTrackingLink
	} else if val, ok := shippingMap["tracking_link"].(string); ok && val != "" {
		trackingLink = val
	} else if val, ok := shippingMap["trackingLink"].(string); ok && val != "" {
		trackingLink = val
	} else if trackingNumber != "" {
		trackingLink = fmt.Sprintf("https://cekresi.com/?noresi=%s", trackingNumber)
	}

	shippingMap["courier_name"] = courierName
	shippingMap["courierName"] = courierName
	shippingMap["service_type"] = serviceType
	shippingMap["courierService"] = serviceType
	shippingMap["etd"] = etd
	shippingMap["courierEtd"] = etd
	if trackingNumber != "" {
		shippingMap["tracking_number"] = trackingNumber
		shippingMap["trackingNumber"] = trackingNumber
	}
	if trackingLink != "" {
		shippingMap["tracking_link"] = trackingLink
		shippingMap["trackingLink"] = trackingLink
	}

	if o.CourierName == nil || *o.CourierName == "" || *o.CourierName == "-" {
		o.CourierName = &courierName
	}
	if o.CourierService == nil || *o.CourierService == "" || *o.CourierService == "-" {
		o.CourierService = &serviceType
	}
	if (o.WaybillID == nil || *o.WaybillID == "") && trackingNumber != "" {
		o.WaybillID = &trackingNumber
	}

	return shippingMap
}

func mapRowToOrder(cols []string, values []interface{}) models.Order {
	var o models.Order
	rowMap := make(map[string]interface{})

	for i, col := range cols {
		val := values[i]
		if b, ok := val.([]byte); ok {
			var js interface{}
			if err := json.Unmarshal(b, &js); err == nil {
				rowMap[col] = js
			} else {
				rowMap[col] = string(b)
			}
		} else {
			rowMap[col] = val
		}
	}

	if val, ok := rowMap["id"].(string); ok {
		o.ID = val
	}
	if val, ok := rowMap["order_number"].(string); ok {
		o.OrderNumber = &val
	}
	if val, ok := rowMap["user_id"].(string); ok {
		o.UserID = val
	}
	if val, ok := rowMap["customer_name"].(string); ok {
		o.CustomerName = &val
	}
	if val, ok := rowMap["customer_email"].(string); ok {
		o.CustomerEmail = &val
	}
	if val, ok := rowMap["customer_phone"].(string); ok {
		o.CustomerPhone = &val
	}
	if val, ok := rowMap["status"].(string); ok {
		o.Status = val
	}

	// Amount mapping
	if val, ok := rowMap["amount"]; ok && val != nil {
		if f, err := strconv.ParseFloat(fmt.Sprintf("%v", val), 64); err == nil {
			o.TotalAmount = f
			o.GrossAmount = f
		}
	}
	if val, ok := rowMap["total_amount"]; ok && val != nil {
		if f, err := strconv.ParseFloat(fmt.Sprintf("%v", val), 64); err == nil {
			o.TotalAmount = f
			o.GrossAmount = f
		}
	}
	if val, ok := rowMap["shipping_cost"]; ok && val != nil {
		if f, err := strconv.ParseFloat(fmt.Sprintf("%v", val), 64); err == nil {
			o.ShippingCost = f
		}
	}
	if val, ok := rowMap["discount_amount"]; ok && val != nil {
		if f, err := strconv.ParseFloat(fmt.Sprintf("%v", val), 64); err == nil {
			o.DiscountAmount = f
		}
	}

	// Payment
	if val, ok := rowMap["payment_type"].(string); ok && val != "" {
		o.PaymentType = &val
		o.PaymentMethod = &val
	} else if val, ok := rowMap["payment_method"].(string); ok && val != "" {
		o.PaymentMethod = &val
		o.PaymentType = &val
	}
	if val, ok := rowMap["snap_token"].(string); ok {
		o.SnapToken = &val
	}

	// Couriers & Waybill
	if val, ok := rowMap["waybill_id"].(string); ok && val != "" {
		o.WaybillID = &val
	} else if val, ok := rowMap["shipping_receipt_number"].(string); ok && val != "" {
		o.WaybillID = &val
	}
	if val, ok := rowMap["courier_name"].(string); ok && val != "" {
		o.CourierName = &val
	}
	if val, ok := rowMap["courier_service"].(string); ok && val != "" {
		o.CourierService = &val
	}
	if val, ok := rowMap["courier_tracking_link"].(string); ok && val != "" {
		o.CourierTrackingLink = &val
	}
	if val, ok := rowMap["biteship_order_id"].(string); ok && val != "" {
		o.BiteshipOrderID = &val
	}
	if val, ok := rowMap["notes"].(string); ok {
		o.Notes = &val
	}

	// Raw JSON fields
	if val, ok := rowMap["shipping_address"]; ok && val != nil {
		if b, err := json.Marshal(val); err == nil {
			o.ShippingAddress = b
		}
	}
	if val, ok := rowMap["shipping_detail"]; ok && val != nil {
		if b, err := json.Marshal(val); err == nil {
			o.ShippingDetail = b
		}
		// Fallback courier extraction from shipping_detail
		if sMap, ok := val.(map[string]interface{}); ok {
			if o.CourierName == nil || *o.CourierName == "" {
				if cN, ok := sMap["courierName"].(string); ok && cN != "" {
					o.CourierName = &cN
				} else if cN, ok := sMap["courier_name"].(string); ok && cN != "" {
					o.CourierName = &cN
				}
			}
			if o.CourierService == nil || *o.CourierService == "" {
				if cS, ok := sMap["courierService"].(string); ok && cS != "" {
					o.CourierService = &cS
				} else if cS, ok := sMap["service_type"].(string); ok && cS != "" {
					o.CourierService = &cS
				}
			}
		}
	}
	if val, ok := rowMap["status_history"]; ok && val != nil {
		if b, err := json.Marshal(val); err == nil {
			o.StatusHistory = b
		}
	}
	if val, ok := rowMap["tracking_history"]; ok && val != nil {
		if b, err := json.Marshal(val); err == nil {
			o.TrackingHistory = b
		}
	}

	if val, ok := rowMap["created_at"].(time.Time); ok {
		o.CreatedAt = &val
	}
	if val, ok := rowMap["updated_at"].(time.Time); ok {
		o.UpdatedAt = &val
	}

	o.Items = make([]models.OrderItem, 0)
	return o
}

// GetUserOrders returns orders list for a given user
func GetUserOrders(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	authHeader := c.Get("Authorization")
	actor, err := middleware.ParseSupabaseToken(authHeader)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	targetUserID := strings.TrimSpace(c.Query("userId"))
	if targetUserID == "" {
		targetUserID = actor.ID
	}

	isAdmin := actor.Role == "admin" || actor.Role == "superadmin"
	if actor.ID != targetUserID && !isAdmin {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden"})
	}

	limit, _ := strconv.Atoi(c.Query("limit", "100"))
	if limit < 1 || limit > 1000 {
		limit = 100
	}

	query := `SELECT * FROM orders WHERE user_id::text = $1 ORDER BY created_at DESC LIMIT $2`
	rows, err := config.DB.Query(query, targetUserID, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	cols, _ := rows.Columns()
	orders := make([]models.Order, 0)
	var orderIDs []string

	for rows.Next() {
		values := make([]interface{}, len(cols))
		valuePtrs := make([]interface{}, len(cols))
		for i := range values {
			valuePtrs[i] = &values[i]
		}
		if err := rows.Scan(valuePtrs...); err == nil {
			o := mapRowToOrder(cols, values)
			orderIDs = append(orderIDs, o.ID)
			orders = append(orders, o)
		}
	}

	// Fetch items for all loaded orders in 1 query
	if len(orderIDs) > 0 {
		placeholders := make([]string, len(orderIDs))
		args := make([]interface{}, len(orderIDs))
		for i, id := range orderIDs {
			placeholders[i] = "$" + strconv.Itoa(i+1)
			args[i] = id
		}

		itemsQuery := fmt.Sprintf(`SELECT * FROM order_items WHERE order_id::text IN (%s)`, strings.Join(placeholders, ","))
		itemRows, err := config.DB.Query(itemsQuery, args...)
		if err == nil {
			defer itemRows.Close()
			itemCols, _ := itemRows.Columns()
			itemsMap := make(map[string][]models.OrderItem)

			for itemRows.Next() {
				itVals := make([]interface{}, len(itemCols))
				itPtrs := make([]interface{}, len(itemCols))
				for i := range itVals {
					itPtrs[i] = &itVals[i]
				}
				if err := itemRows.Scan(itPtrs...); err == nil {
					itMap := make(map[string]interface{})
					for i, col := range itemCols {
						itMap[col] = itVals[i]
					}
					it := parseOrderItem(itMap)
					itemsMap[it.OrderID] = append(itemsMap[it.OrderID], it)
				}
			}

			for i := range orders {
				if itms, exists := itemsMap[orders[i].ID]; exists {
					orders[i].Items = itms
				}
			}
		}
	}

	// Fetch return_requests info for orders that may have returns
	if len(orderIDs) > 0 {
		placeholders2 := make([]string, len(orderIDs))
		args2 := make([]interface{}, len(orderIDs))
		for i, id := range orderIDs {
			placeholders2[i] = "$" + strconv.Itoa(i+1)
			args2[i] = id
		}
		returnQuery := fmt.Sprintf(
			`SELECT order_id, status, admin_note FROM return_requests WHERE order_id::text IN (%s) ORDER BY created_at DESC`,
			strings.Join(placeholders2, ","),
		)
		returnRows, err := config.DB.Query(returnQuery, args2...)
		if err == nil {
			defer returnRows.Close()
			returnMap := make(map[string]map[string]string)
			for returnRows.Next() {
				var rOrderID, rStatus string
				var rNote sql.NullString
				if err := returnRows.Scan(&rOrderID, &rStatus, &rNote); err == nil {
					// Only keep first (latest) return per order
					if _, exists := returnMap[rOrderID]; !exists {
						returnMap[rOrderID] = map[string]string{
							"return_status": rStatus,
							"admin_note":    rNote.String,
						}
					}
				}
			}
			// Attach return info to matching orders
			for i := range orders {
				if rInfo, exists := returnMap[orders[i].ID]; exists {
					orders[i].ReturnStatus = rInfo["return_status"]
					orders[i].ReturnAdminNote = rInfo["admin_note"]
				}
			}
		}
	}

	// Fetch primary address
	primaryAddress := "Belum diatur"
	var pName sql.NullString
	_ = config.DB.QueryRow("SELECT full_name FROM profiles WHERE id::text = $1 LIMIT 1", targetUserID).Scan(&pName)
	if pName.Valid && pName.String != "" {
		primaryAddress = pName.String
	}

	return c.JSON(fiber.Map{
		"orders":         orders,
		"primaryAddress": primaryAddress,
	})
}

// GetUserOrderDetail returns full detail of a specific order
func GetUserOrderDetail(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	orderID := strings.TrimSpace(c.Params("id"))
	if orderID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Order ID is required"})
	}

	query := `SELECT * FROM orders WHERE id::text = $1 OR order_number = $1 LIMIT 1`
	rows, err := config.DB.Query(query, orderID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	if !rows.Next() {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Pesanan tidak ditemukan."})
	}

	cols, _ := rows.Columns()
	values := make([]interface{}, len(cols))
	valuePtrs := make([]interface{}, len(cols))
	for i := range values {
		valuePtrs[i] = &values[i]
	}
	if err := rows.Scan(valuePtrs...); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	o := mapRowToOrder(cols, values)

	// Fetch items
	itemsQuery := `SELECT * FROM order_items WHERE order_id::text = $1`
	itemRows, err := config.DB.Query(itemsQuery, o.ID)
	if err == nil {
		defer itemRows.Close()
		itemCols, _ := itemRows.Columns()
		for itemRows.Next() {
			itVals := make([]interface{}, len(itemCols))
			itPtrs := make([]interface{}, len(itemCols))
			for i := range itVals {
				itPtrs[i] = &itVals[i]
			}
			if err := itemRows.Scan(itPtrs...); err == nil {
				itMap := make(map[string]interface{})
				for i, col := range itemCols {
					itMap[col] = itVals[i]
				}
				it := parseOrderItem(itMap)
				o.Items = append(o.Items, it)
			}
		}
	}

	// Fetch return_requests info
	var rStatus string
	var rNote sql.NullString
	err = config.DB.QueryRow(`
		SELECT status, admin_note FROM return_requests 
		WHERE order_id::text = $1 ORDER BY created_at DESC LIMIT 1
	`, o.ID).Scan(&rStatus, &rNote)
	if err == nil {
		fmt.Printf("DEBUG GetUserOrderDetail: Found return_request for %s, status=%s, note=%s\n", o.ID, rStatus, rNote.String)
		o.ReturnStatus = rStatus
		if rNote.Valid {
			o.ReturnAdminNote = rNote.String
		}
	} else {
		fmt.Printf("DEBUG GetUserOrderDetail: No return_request found for %s, err: %v\n", o.ID, err)
	}

	shipping := buildNormalizedShipping(&o)

	return c.JSON(fiber.Map{
		"order":            o,
		"shipping":         shipping,
		"items":            o.Items,
		"statusHistory":    o.StatusHistory,
		"status_history":   o.StatusHistory,
		"trackingHistory":  o.TrackingHistory,
		"tracking_history": o.TrackingHistory,
	})
}

// PayOrder generates or returns existing Snap Token for payment
func PayOrder(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	orderID := strings.TrimSpace(c.Params("id"))
	var req struct {
		ReceiptURL *string `json:"receiptUrl"`
	}
	_ = c.BodyParser(&req)

	rows, err := config.DB.Query(`SELECT * FROM orders WHERE id::text = $1 OR order_number = $1 LIMIT 1`, orderID)
	if err != nil || !rows.Next() {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Pesanan tidak ditemukan."})
	}
	cols, _ := rows.Columns()
	values := make([]interface{}, len(cols))
	valuePtrs := make([]interface{}, len(cols))
	for i := range values {
		valuePtrs[i] = &values[i]
	}
	_ = rows.Scan(valuePtrs...)
	rows.Close()

	o := mapRowToOrder(cols, values)

	// If manual payment proof uploaded
	if req.ReceiptURL != nil && *req.ReceiptURL != "" {
		newShippingDetail := fmt.Sprintf(`{"payment_proof_url": "%s"}`, *req.ReceiptURL)
		_, err := config.DB.Exec(`UPDATE orders SET shipping_detail = COALESCE(shipping_detail, '{}'::jsonb) || $1::jsonb, status = 'verifying', updated_at = NOW() WHERE id::text = $2`, newShippingDetail, o.ID)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal menyimpan bukti pembayaran."})
		}
		return c.JSON(fiber.Map{"success": true})
	}

	// If this order is manual transfer and no receiptURL was provided
	if o.PaymentMethod != nil && strings.Contains(strings.ToLower(*o.PaymentMethod), "manual") {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Pesanan ini menggunakan transfer manual. Silakan unggah bukti pembayaran."})
	}

	// If snap token already exists, return it
	if o.SnapToken != nil && *o.SnapToken != "" {
		return c.JSON(fiber.Map{"snap_token": *o.SnapToken})
	}

	// Fetch items for Midtrans
	itemRows, _ := config.DB.Query("SELECT * FROM order_items WHERE order_id::text = $1", o.ID)
	var snapItems []services.SnapItem
	if itemRows != nil {
		defer itemRows.Close()
		itemCols, _ := itemRows.Columns()
		for itemRows.Next() {
			itVals := make([]interface{}, len(itemCols))
			itPtrs := make([]interface{}, len(itemCols))
			for i := range itVals {
				itPtrs[i] = &itVals[i]
			}
			if err := itemRows.Scan(itPtrs...); err == nil {
				itMap := make(map[string]interface{})
				for i, col := range itemCols {
					itMap[col] = itVals[i]
				}
				it := parseOrderItem(itMap)
				snapItems = append(snapItems, services.SnapItem{
					ID:       it.ProductID,
					Name:     it.ProductName,
					Price:    int64(math.Round(it.Price)),
					Quantity: it.Quantity,
				})
			}
		}
	}

	name := "Customer"
	if o.CustomerName != nil && *o.CustomerName != "" {
		name = *o.CustomerName
	}
	email := "customer@mameko.my.id"
	if o.CustomerEmail != nil && *o.CustomerEmail != "" {
		email = *o.CustomerEmail
	}
	phone := ""
	if o.CustomerPhone != nil {
		phone = *o.CustomerPhone
	}

	tokenID := o.ID
	if o.OrderNumber != nil && *o.OrderNumber != "" {
		tokenID = *o.OrderNumber
	}

	var snapShippingAddress *services.SnapAddress
	if len(o.ShippingAddress) > 0 {
		var shipMap map[string]interface{}
		if err := json.Unmarshal(o.ShippingAddress, &shipMap); err == nil {
			recipientName, _ := shipMap["recipientName"].(string)
			if recipientName == "" {
				recipientName = name
			}
			recipientPhone, _ := shipMap["recipientPhone"].(string)
			if recipientPhone == "" {
				recipientPhone = phone
			}
			address, _ := shipMap["fullAddress"].(string)
			city, _ := shipMap["city"].(string)
			postalCode, _ := shipMap["postalCode"].(string)

			snapShippingAddress = &services.SnapAddress{
				FirstName:   recipientName,
				Phone:       recipientPhone,
				Address:     address,
				City:        city,
				PostalCode:  postalCode,
				CountryCode: "IDN",
			}
		}
	}

	custDetails := services.SnapCustomerDetails{
		FirstName:       name,
		Email:           email,
		Phone:           phone,
		ShippingAddress: snapShippingAddress,
	}

	token, err := services.CreateSnapToken(tokenID, o.GrossAmount, custDetails, snapItems)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal menghasilkan token pembayaran: " + err.Error()})
	}

	// Save token in database
	_, _ = config.DB.Exec("UPDATE orders SET snap_token = $1, updated_at = NOW() WHERE id::text = $2", token, o.ID)

	return c.JSON(fiber.Map{"snap_token": token})
}

// CancelOrder cancels an unpaid order
func CancelOrder(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	orderID := strings.TrimSpace(c.Params("id"))
	authHeader := c.Get("Authorization")
	user, err := middleware.ParseSupabaseToken(authHeader)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var reqBody struct {
		Reason string `json:"reason"`
	}
	_ = c.BodyParser(&reqBody)
	cancelNote := "Pesanan dibatalkan oleh pengguna."
	if reqBody.Reason != "" {
		cancelNote = fmt.Sprintf("Pesanan dibatalkan oleh pengguna: %s", reqBody.Reason)
	}

	historyEntry := map[string]interface{}{
		"status":      "cancelled",
		"status_to":   "cancelled",
		"actor":       "user",
		"actor_label": "Pengguna",
		"notes":       cancelNote,
		"timestamp":   time.Now().UTC().Format(time.RFC3339),
		"created_at":  time.Now().UTC().Format(time.RFC3339),
	}
	historyBytes, _ := json.Marshal(historyEntry)

	var proofURL sql.NullString
	_ = config.DB.QueryRow(`
		SELECT COALESCE(shipping_detail->>'payment_proof_url', '') 
		FROM orders 
		WHERE (id::text = $1 OR order_number = $1) AND user_id::text = $2
	`, orderID, user.ID).Scan(&proofURL)

	res, err := config.DB.Exec(`
		UPDATE orders 
		SET status = 'cancelled',
		    status_history = COALESCE(status_history, '[]'::jsonb) || $3::jsonb,
		    updated_at = NOW()
		WHERE (id::text = $1 OR order_number = $1) AND user_id::text = $2 AND status IN ('pending', 'unpaid', 'verifying')
	`, orderID, user.ID, fmt.Sprintf("[%s]", string(historyBytes)))

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if aff, _ := res.RowsAffected(); aff == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Pesanan tidak dapat dibatalkan atau tidak ditemukan."})
	}

	// Delete payment proof from Cloudinary if user uploaded one
	if proofURL.Valid && proofURL.String != "" {
		go services.DeleteCloudinaryImage(proofURL.String)
	}

	// Release any locked vouchers
	_, _ = config.DB.Exec(`UPDATE user_vouchers SET used_at = NULL, order_id = NULL WHERE order_id = $1`, orderID)

	return c.JSON(fiber.Map{"success": true, "message": "Pesanan berhasil dibatalkan."})
}

// ConfirmOrderReceived confirms delivery by buyer
func ConfirmOrderReceived(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	orderID := strings.TrimSpace(c.Params("id"))
	authHeader := c.Get("Authorization")
	user, err := middleware.ParseSupabaseToken(authHeader)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	historyEntry := map[string]interface{}{
		"status":      "completed",
		"status_to":   "completed",
		"actor":       "user",
		"actor_label": "Pengguna",
		"notes":       "Pesanan telah diterima dan dikonfirmasi selesai oleh pembeli.",
		"timestamp":   time.Now().UTC().Format(time.RFC3339),
		"created_at":  time.Now().UTC().Format(time.RFC3339),
	}
	historyBytes, _ := json.Marshal(historyEntry)

	res, err := config.DB.Exec(`
		UPDATE orders 
		SET status = 'completed',
		    status_history = COALESCE(status_history, '[]'::jsonb) || $3::jsonb,
		    updated_at = NOW()
		WHERE (id::text = $1 OR order_number = $1) AND user_id::text = $2 AND status IN ('shipped', 'delivered')
	`, orderID, user.ID, fmt.Sprintf("[%s]", string(historyBytes)))

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if aff, _ := res.RowsAffected(); aff == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Pesanan belum dalam status pengiriman atau tidak ditemukan."})
	}

	return c.JSON(fiber.Map{"success": true, "message": "Pesanan berhasil dikonfirmasi selesai."})
}

// RequestOrderReturn submits a return request
func RequestOrderReturn(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	orderID := strings.TrimSpace(c.Params("id"))
	authHeader := c.Get("Authorization")
	user, err := middleware.ParseSupabaseToken(authHeader)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req struct {
		Reason     string  `json:"reason"`
		Evidence   *string `json:"evidence"`
		BankName   *string `json:"bankName"`
		BankNumber *string `json:"bankNumber"`
		BankHolder *string `json:"bankHolder"`
	}
	if err := c.BodyParser(&req); err != nil || strings.TrimSpace(req.Reason) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Alasan retur wajib diisi."})
	}

	// Update order status, status_history, and get actual UUID
	var actualOrderID string
	historyJSON := fmt.Sprintf(`[{"status_to": "return_requested", "actor": "user", "notes": "Pengajuan return sedang diproses.", "created_at": "%s"}]`, time.Now().Format(time.RFC3339))
	err = config.DB.QueryRow(`
		UPDATE orders SET status = 'return_requested', status_history = COALESCE(status_history, '[]'::jsonb) || $3::jsonb, updated_at = NOW()
		WHERE (id::text = $1 OR order_number = $1) AND user_id::text = $2
		RETURNING id
	`, orderID, user.ID, historyJSON).Scan(&actualOrderID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update order status: " + err.Error()})
	}

	// Insert into return_requests table if exists
	_, err = config.DB.Exec(`
		INSERT INTO return_requests (order_id, user_id, reason, evidence_url, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, 'pending', NOW(), NOW())
	`, actualOrderID, user.ID, req.Reason, req.Evidence)
	if err != nil {
		// Log the error but don't fail the request completely since the order status was updated
		fmt.Printf("Warning: failed to insert return_request for order %s: %v\n", actualOrderID, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Pesanan diupdate tapi gagal mencatat form retur: " + err.Error()})
	}

	// Insert Admin Notification
	_, _ = config.DB.Exec(`
		INSERT INTO notifications (title, message, audience, link, created_at, updated_at)
		VALUES ($1, $2, 'admin', $3, NOW(), NOW())
	`, "Pengajuan Retur Baru", fmt.Sprintf("Ada pengajuan retur baru untuk pesanan %s.", actualOrderID), "/admin/orders?tab=returns")

	return c.JSON(fiber.Map{"success": true, "message": "Pengajuan retur berhasil dikirim."})
}

// SyncOrderPayment synchronizes local order status when user finishes Midtrans Snap
func SyncOrderPayment(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	orderID := strings.TrimSpace(c.Params("id"))
	if orderID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Order ID is required"})
	}

	var (
		orderNumber   string
		currentStatus string
	)
	err := config.DB.QueryRow(`
		SELECT order_number, status
		FROM orders
		WHERE id::text = $1 OR order_number = $1
		LIMIT 1
	`, orderID).Scan(&orderNumber, &currentStatus)

	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Order not found"})
	}

	var req struct {
		TransactionStatus string `json:"transaction_status"`
		StatusCode        string `json:"status_code"`
	}
	_ = c.BodyParser(&req)

	newStatus := currentStatus
	if req.TransactionStatus != "" || req.StatusCode != "" {
		if req.TransactionStatus == "settlement" || req.TransactionStatus == "capture" || req.StatusCode == "200" {
			newStatus = "paid"
		} else if req.TransactionStatus == "deny" || req.TransactionStatus == "cancel" || req.TransactionStatus == "expire" {
			newStatus = "cancelled"
		}
	} else {
		// Inquiry directly to Midtrans API using order_number or orderID
		inquiryRef := orderNumber
		if inquiryRef == "" {
			inquiryRef = orderID
		}
		if statusResp, err := services.CheckMidtransStatus(inquiryRef); err == nil && statusResp != nil {
			tStatus, _ := statusResp["transaction_status"].(string)
			fStatus, _ := statusResp["fraud_status"].(string)
			if tStatus == "settlement" || (tStatus == "capture" && (fStatus == "" || fStatus == "accept")) {
				newStatus = "paid"
			} else if tStatus == "deny" || tStatus == "cancel" || tStatus == "expire" {
				newStatus = "cancelled"
			} else if tStatus == "pending" {
				newStatus = "pending"
			}
		}
	}

	if newStatus != currentStatus {
		statusEntry := map[string]interface{}{
			"status":    newStatus,
			"timestamp": time.Now().UTC().Format(time.RFC3339),
			"note":      "Status pembayaran disinkronkan",
		}
		sBytes, _ := json.Marshal(statusEntry)
		_, _ = config.DB.Exec(`
			UPDATE orders SET
				status = $1,
				status_history = COALESCE(status_history, '[]'::jsonb) || $2::jsonb,
				updated_at = NOW()
			WHERE id::text = $3 OR order_number = $3
		`, newStatus, fmt.Sprintf("[%s]", string(sBytes)), orderID)
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Status pembayaran berhasil disinkronkan.",
		"status":  newStatus,
		"data": fiber.Map{
			"status":      newStatus,
			"orderId":     orderID,
			"orderNumber": orderNumber,
		},
	})
}

// GetUserReturns returns list of return requests submitted by user
func GetUserReturns(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	authHeader := c.Get("Authorization")
	user, err := middleware.ParseSupabaseToken(authHeader)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	rows, err := config.DB.Query(`
		SELECT id, order_id, user_id, reason, evidence_url, status, admin_note, created_at
		FROM return_requests
		WHERE user_id::text = $1
		ORDER BY created_at DESC
	`, user.ID)

	if err != nil {
		return c.JSON(fiber.Map{"returns": []interface{}{}})
	}
	defer rows.Close()

	returns := make([]map[string]interface{}, 0)
	for rows.Next() {
		var id, oID, uID, reason, status string
		var evidence, adminNote sql.NullString
		var cAt time.Time
		if err := rows.Scan(&id, &oID, &uID, &reason, &evidence, &status, &adminNote, &cAt); err == nil {
			returns = append(returns, map[string]interface{}{
				"id":         id,
				"orderId":    oID,
				"userId":     uID,
				"reason":     reason,
				"evidence":   evidence.String,
				"status":     status,
				"adminNote":  adminNote.String,
				"createdAt":  cAt,
			})
		} else {
			fmt.Println("Scan error:", err)
		}
	}

	return c.JSON(fiber.Map{"returns": returns})
}

type CheckoutItemRequest struct {
	ProductID   string  `json:"productId"`
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	ProductName string  `json:"productName"`
	Size        string  `json:"size"`
	VariantName string  `json:"variantName"`
	Price       float64 `json:"price"`
	Quantity    int     `json:"quantity"`
	ImageURL    string  `json:"imageUrl"`
}

type CustomerDetailsRequest struct {
	Name  string `json:"name"`
	Email string `json:"email"`
	Phone string `json:"phone"`
}

type CreateCheckoutRequest struct {
	UserID                 string                 `json:"userId"`
	OrderID                string                 `json:"orderId"`
	Amount                 float64                `json:"amount"`
	Items                  []CheckoutItemRequest  `json:"items"`
	CustomerDetails        *CustomerDetailsRequest `json:"customerDetails"`
	ShippingAddress        map[string]interface{} `json:"shippingAddress"`
	ShippingCost           float64                `json:"shippingCost"`
	ShippingDetail         map[string]interface{} `json:"shippingDetail"`
	DiscountAmount         float64                `json:"discountAmount"`
	ShippingVoucherID      *string                `json:"shippingVoucherId"`
	ShippingVoucherClaimID *string                `json:"shippingVoucherClaimId"`
	DiscountVoucherID      *string                `json:"discountVoucherId"`
	DiscountVoucherClaimID *string                `json:"discountVoucherClaimId"`
	PaymentMethod          string                 `json:"paymentMethod"`
}

// CreateCheckoutTransaction creates a new order, updates stock, and generates Midtrans Snap token if applicable
func CreateCheckoutTransaction(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	var req CreateCheckoutRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body: " + err.Error()})
	}

	orderID := strings.TrimSpace(req.OrderID)
	if orderID == "" {
		orderID = fmt.Sprintf("ord_%d", time.Now().UnixNano())
	}

	authHeader := c.Get("Authorization")
	if actor, err := middleware.ParseSupabaseToken(authHeader); err == nil && actor != nil {
		if req.UserID == "" {
			req.UserID = actor.ID
		}
	}

	custName := "Customer"
	custEmail := "customer@mameko.my.id"
	custPhone := "08123456789"

	if req.CustomerDetails != nil {
		if req.CustomerDetails.Name != "" {
			custName = req.CustomerDetails.Name
		}
		if req.CustomerDetails.Email != "" {
			custEmail = req.CustomerDetails.Email
		}
		if req.CustomerDetails.Phone != "" {
			custPhone = req.CustomerDetails.Phone
		}
	}

	if recipientName, ok := req.ShippingAddress["recipientName"].(string); ok && recipientName != "" {
		custName = recipientName
	}
	if recipientPhone, ok := req.ShippingAddress["recipientPhone"].(string); ok && recipientPhone != "" {
		custPhone = recipientPhone
	}

	// Calculate gross amount
	grossAmount := req.Amount - req.DiscountAmount + req.ShippingCost
	if grossAmount < 0 {
		grossAmount = 0
	}

	orderNumber := fmt.Sprintf("ORD-%s-%s", time.Now().Format("20060102"), strings.ToUpper(orderID[:min(8, len(orderID))]))
	isManual := strings.EqualFold(req.PaymentMethod, "manual")
	paymentType := "Midtrans"
	if isManual {
		paymentType = "Manual Transfer"
	}

	var snapToken *string
	if !isManual {
		finalGross := math.Round(math.Max(1, grossAmount))
		intGross := int64(finalGross)
		snapItems := make([]services.SnapItem, 0)

		var itemsSum int64

		// 1. Tambahkan item produk dari keranjang
		for _, it := range req.Items {
			pID := it.ProductID
			if pID == "" {
				pID = it.ID
			}
			if pID == "" {
				pID = "ITEM"
			}
			pName := it.ProductName
			if pName == "" {
				pName = it.Name
			}
			if pName == "" {
				pName = "Produk MAMEKO"
			}
			if it.Size != "" {
				pName = fmt.Sprintf("%s (%s)", pName, it.Size)
			}
			qty := it.Quantity
			if qty <= 0 {
				qty = 1
			}
			price := int64(math.Round(it.Price))
			if price <= 0 {
				price = 1
			}

			itemsSum += price * int64(qty)
			snapItems = append(snapItems, services.SnapItem{
				ID:       pID,
				Name:     pName,
				Price:    price,
				Quantity: qty,
			})
		}

		// 2. Tambahkan ongkos kirim jika ada
		if req.ShippingCost > 0 {
			courierLabel := "Ongkos Kirim"
			if cName, ok := req.ShippingDetail["courierName"].(string); ok && cName != "" {
				cSvc, _ := req.ShippingDetail["courierService"].(string)
				if cSvc != "" {
					courierLabel = fmt.Sprintf("Ongkir (%s - %s)", cName, cSvc)
				} else {
					courierLabel = fmt.Sprintf("Ongkir (%s)", cName)
				}
			}
			shippingPrice := int64(math.Round(req.ShippingCost))
			itemsSum += shippingPrice
			snapItems = append(snapItems, services.SnapItem{
				ID:       "SHIPPING",
				Name:     courierLabel,
				Price:    shippingPrice,
				Quantity: 1,
			})
		}

		// 3. Tambahkan potongan voucher diskon jika ada
		if req.DiscountAmount > 0 {
			discountPrice := int64(math.Round(req.DiscountAmount))
			itemsSum -= discountPrice
			snapItems = append(snapItems, services.SnapItem{
				ID:       "DISCOUNT",
				Name:     "Diskon Voucher",
				Price:    -discountPrice,
				Quantity: 1,
			})
		}

		// 4. Verifikasi presisi total itemsSum dengan intGross
		diff := intGross - itemsSum
		if diff != 0 && len(snapItems) > 0 {
			// Sesuaikan perbedaan 1-rupiah pembulatan pada item diskon atau item terakhir
			for i := range snapItems {
				if snapItems[i].ID == "DISCOUNT" {
					snapItems[i].Price += diff
					itemsSum += diff
					break
				}
			}
			if itemsSum != intGross {
				snapItems[len(snapItems)-1].Price += diff
				itemsSum += diff
			}
		}

		grossAmount = float64(intGross)

		var snapShippingAddress *services.SnapAddress
		if len(req.ShippingAddress) > 0 {
			recipientName, _ := req.ShippingAddress["recipientName"].(string)
			if recipientName == "" {
				recipientName, _ = req.ShippingAddress["full_name"].(string)
			}
			if recipientName == "" {
				recipientName = custName
			}
			recipientPhone, _ := req.ShippingAddress["recipientPhone"].(string)
			if recipientPhone == "" {
				recipientPhone, _ = req.ShippingAddress["phone"].(string)
			}
			if recipientPhone == "" {
				recipientPhone = custPhone
			}

			street, _ := req.ShippingAddress["street"].(string)
			district, _ := req.ShippingAddress["district"].(string)
			city, _ := req.ShippingAddress["city"].(string)
			province, _ := req.ShippingAddress["province"].(string)
			postalCode, _ := req.ShippingAddress["postalCode"].(string)
			notes, _ := req.ShippingAddress["notes"].(string)
			fullAddress, _ := req.ShippingAddress["fullAddress"].(string)
			if fullAddress == "" {
				fullAddress, _ = req.ShippingAddress["address"].(string)
			}

			var addressLine string
			if fullAddress != "" {
				addressLine = fullAddress
			} else {
				var parts []string
				if street != "" {
					parts = append(parts, street)
				}
				if district != "" {
					parts = append(parts, "Kec. "+district)
				}
				if notes != "" {
					parts = append(parts, fmt.Sprintf("(Patokan: %s)", notes))
				}
				if len(parts) == 0 {
					if city != "" {
						parts = append(parts, city)
					}
					if province != "" {
						parts = append(parts, province)
					}
				}
				addressLine = strings.Join(parts, ", ")
			}

			snapShippingAddress = &services.SnapAddress{
				FirstName:   recipientName,
				Phone:       recipientPhone,
				Address:     addressLine,
				City:        city,
				PostalCode:  postalCode,
				CountryCode: "IDN",
			}
		}

		custDetails := services.SnapCustomerDetails{
			FirstName:       custName,
			Email:           custEmail,
			Phone:           custPhone,
			BillingAddress:  snapShippingAddress,
			ShippingAddress: snapShippingAddress,
		}

		token, err := services.CreateSnapToken(orderNumber, grossAmount, custDetails, snapItems)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"error":   "Gagal membuat transaksi Midtrans: " + err.Error(),
			})
		}
		snapToken = &token
	}

	shipAddrBytes, _ := json.Marshal(req.ShippingAddress)
	shipDetailBytes, _ := json.Marshal(req.ShippingDetail)
	statusHistBytes, _ := json.Marshal([]map[string]interface{}{
		{
			"status":    "pending",
			"timestamp": time.Now().Format(time.RFC3339),
			"note":      "Pesanan dibuat",
		},
	})

	var userIDVal interface{} = nil
	if req.UserID != "" && req.UserID != "guest" {
		userIDVal = req.UserID
	}

	insertOrderQuery := `
		INSERT INTO orders (
			id, order_number, user_id, status, amount, total_amount,
			shipping_cost, discount_amount, payment_type, customer_name,
			customer_email, customer_phone, shipping_address, shipping_detail,
			snap_token, status_history, created_at, updated_at
		) VALUES (
			$1, $2, $3, 'pending', $4, $5,
			$6, $7, $8, $9,
			$10, $11, $12::jsonb, $13::jsonb,
			$14, $15::jsonb, NOW(), NOW()
		) ON CONFLICT (id) DO UPDATE SET
			status = EXCLUDED.status,
			snap_token = EXCLUDED.snap_token,
			updated_at = NOW()
	`

	_, err := config.DB.Exec(
		insertOrderQuery,
		orderID, orderNumber, userIDVal, req.Amount, grossAmount,
		req.ShippingCost, req.DiscountAmount, paymentType, custName,
		custEmail, custPhone, string(shipAddrBytes), string(shipDetailBytes),
		snapToken, string(statusHistBytes),
	)

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   "Gagal menyimpan data pesanan: " + err.Error(),
		})
	}

	// Insert order items
	for _, it := range req.Items {
		pID := it.ProductID
		if pID == "" {
			pID = it.ID
		}
		pName := it.ProductName
		if pName == "" {
			pName = it.Name
		}
		vName := it.VariantName
		if vName == "" {
			vName = it.Size
		}
		qty := it.Quantity
		if qty <= 0 {
			qty = 1
		}

		_, _ = config.DB.Exec(`
			INSERT INTO order_items (order_id, product_id, product_name, variant_name, quantity, price, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, NOW())
		`, orderID, pID, pName, vName, qty, it.Price)

		// Decrement product variant stock
		if pID != "" {
			var variantsJSON []byte
			if err := config.DB.QueryRow("SELECT variants FROM products WHERE id::text = $1", pID).Scan(&variantsJSON); err == nil && len(variantsJSON) > 0 {
				var variants []map[string]interface{}
				if err := json.Unmarshal(variantsJSON, &variants); err == nil {
					updated := false
					for _, v := range variants {
						sizeVal, _ := v["size"].(string)
						if sizeVal == vName || len(variants) == 1 {
							if curStock, ok := v["stock"].(float64); ok {
								v["stock"] = max(0, int(curStock)-qty)
								updated = true
							}
						}
					}
					if updated {
						if newVariantsBytes, err := json.Marshal(variants); err == nil {
							_, _ = config.DB.Exec("UPDATE products SET variants = $1::jsonb WHERE id::text = $2", string(newVariantsBytes), pID)
						}
					}
				}
			}
		}
	}

	// Claim vouchers if applicable
	if req.DiscountVoucherClaimID != nil && *req.DiscountVoucherClaimID != "" {
		_, _ = config.DB.Exec("UPDATE user_vouchers SET status = 'used', used_at = NOW(), order_id = $1::uuid WHERE id::text = $2", orderID, *req.DiscountVoucherClaimID)
	}
	if req.ShippingVoucherClaimID != nil && *req.ShippingVoucherClaimID != "" {
		_, _ = config.DB.Exec("UPDATE user_vouchers SET status = 'used', used_at = NOW(), order_id = $1::uuid WHERE id::text = $2", orderID, *req.ShippingVoucherClaimID)
	}

	if isManual {
		return c.JSON(fiber.Map{
			"success": true,
			"method":  "manual",
			"orderId": orderID,
		})
	}

	tokenStr := ""
	if snapToken != nil {
		tokenStr = *snapToken
	}

	return c.JSON(fiber.Map{
		"success": true,
		"token":   tokenStr,
		"orderId": orderID,
	})
}

