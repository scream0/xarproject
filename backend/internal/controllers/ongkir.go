package controllers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
	"xar-backend-go/internal/config"

	"github.com/gofiber/fiber/v2"
)

var (
	ratesCacheLock sync.RWMutex
	ratesCacheMap  = make(map[string]ratesCacheEntry)
)

type ratesCacheEntry struct {
	costs     []fiber.Map
	timestamp time.Time
}

// getStoreOriginAreaId retrieves the store's default Biteship Area ID
func getStoreOriginAreaId() string {
	if config.DB == nil {
		return config.DefaultStoreOriginAreaID
	}

	var storeCityID sql.NullString
	_ = config.DB.QueryRow("SELECT store_city_id FROM store_config WHERE id = 'main' LIMIT 1").Scan(&storeCityID)
	if storeCityID.Valid && strings.TrimSpace(storeCityID.String) != "" {
		return strings.TrimSpace(storeCityID.String)
	}

	return config.DefaultStoreOriginAreaID
}

func buildFallbackCosts(weight int, requestedCourier string) []fiber.Map {
	kg := int(math.Max(1, math.Ceil(float64(weight)/1000.0)))
	base := int(math.Max(12000, float64(8000+kg*3500)))

	allFallbacks := []fiber.Map{
		{
			"courier":     "jne",
			"courierName": "JNE",
			"services": []fiber.Map{
				{
					"service":     "REG",
					"description": "Layanan Reguler",
					"cost":        base,
					"etd":         "1-2",
					"note":        "Estimasi lokal",
				},
				{
					"service":     "OKE",
					"description": "Layanan Ekonomis",
					"cost":        int(math.Max(10000, float64(base-2000))),
					"etd":         "2-3",
					"note":        "Estimasi lokal",
				},
			},
		},
		{
			"courier":     "jnt",
			"courierName": "J&T Express",
			"services": []fiber.Map{
				{
					"service":     "EZ",
					"description": "Layanan Reguler Cepat",
					"cost":        base + 2000,
					"etd":         "1-2",
					"note":        "Estimasi lokal",
				},
			},
		},
		{
			"courier":     "sicepat",
			"courierName": "SiCepat",
			"services": []fiber.Map{
				{
					"service":     "SIUNT",
					"description": "SiUntung Reguler",
					"cost":        base + 1000,
					"etd":         "1-2",
					"note":        "Estimasi lokal",
				},
				{
					"service":     "GOKIL",
					"description": "Cargo Kilat",
					"cost":        int(math.Max(15000, float64(base+4000))),
					"etd":         "2-4",
					"note":        "Estimasi lokal",
				},
			},
		},
		{
			"courier":     "anteraja",
			"courierName": "AnterAja",
			"services": []fiber.Map{
				{
					"service":     "REG",
					"description": "Layanan Reguler",
					"cost":        base,
					"etd":         "1-2",
					"note":        "Estimasi lokal",
				},
			},
		},
		{
			"courier":     "pos",
			"courierName": "POS Indonesia",
			"services": []fiber.Map{
				{
					"service":     "POS",
					"description": "Pos Reguler",
					"cost":        int(math.Max(9000, float64(base-1000))),
					"etd":         "2-4",
					"note":        "Estimasi lokal",
				},
			},
		},
	}

	if requestedCourier != "" && requestedCourier != "all" {
		courierList := strings.Split(strings.ToLower(requestedCourier), ",")
		var filtered []fiber.Map
		for _, c := range allFallbacks {
			cCode := strings.ToLower(fmt.Sprintf("%v", c["courier"]))
			for _, reqC := range courierList {
				if strings.TrimSpace(reqC) == cCode {
					filtered = append(filtered, c)
					break
				}
			}
		}
		if len(filtered) > 0 {
			return filtered
		}
	}

	return allFallbacks
}

// CalculateOngkir handles real-time shipping rates using Biteship Rates API
func CalculateOngkir(c *fiber.Ctx) error {
	originAreaID := strings.TrimSpace(c.Query("originAreaId"))
	if originAreaID == "" {
		originAreaID = strings.TrimSpace(c.Query("origin_area_id"))
	}
	if originAreaID == "" {
		originAreaID = strings.TrimSpace(c.Query("origin"))
	}

	destAreaID := strings.TrimSpace(c.Query("destinationAreaId"))
	if destAreaID == "" {
		destAreaID = strings.TrimSpace(c.Query("destination_area_id"))
	}
	if destAreaID == "" {
		destAreaID = strings.TrimSpace(c.Query("destination"))
	}

	weightStr := strings.TrimSpace(c.Query("weight"))
	couriers := strings.TrimSpace(c.Query("couriers"))
	if couriers == "" {
		couriers = strings.TrimSpace(c.Query("courier"))
	}

	// Also support JSON POST body
	if c.Method() == fiber.MethodPost {
		var body struct {
			OriginAreaID      string `json:"originAreaId"`
			OriginAreaIDAlt   string `json:"origin_area_id"`
			Origin            string `json:"origin"`
			DestinationAreaID string `json:"destinationAreaId"`
			DestAreaIDAlt     string `json:"destination_area_id"`
			Destination       string `json:"destination"`
			Weight            int    `json:"weight"`
			Couriers          string `json:"couriers"`
			Courier           string `json:"courier"`
		}
		if err := c.BodyParser(&body); err == nil {
			if body.OriginAreaID != "" {
				originAreaID = body.OriginAreaID
			} else if body.OriginAreaIDAlt != "" {
				originAreaID = body.OriginAreaIDAlt
			} else if body.Origin != "" {
				originAreaID = body.Origin
			}

			if body.DestinationAreaID != "" {
				destAreaID = body.DestinationAreaID
			} else if body.DestAreaIDAlt != "" {
				destAreaID = body.DestAreaIDAlt
			} else if body.Destination != "" {
				destAreaID = body.Destination
			}

			if body.Weight > 0 {
				weightStr = strconv.Itoa(body.Weight)
			}
			if body.Couriers != "" {
				couriers = body.Couriers
			} else if body.Courier != "" {
				couriers = body.Courier
			}
		}
	}

	// Fallback origin area if not passed
	if originAreaID == "" {
		originAreaID = getStoreOriginAreaId()
	}

	weight, _ := strconv.Atoi(weightStr)
	if weight <= 0 {
		weight = config.DefaultItemWeightGrams
	}

	if couriers == "" {
		couriers = config.DefaultActiveCouriers
	}

	// If no destination area is specified, return fallback immediately
	if destAreaID == "" {
		return c.JSON(fiber.Map{
			"success":  true,
			"fallback": true,
			"warning":  "Wilayah tujuan belum terdeteksi. Menggunakan estimasi ongkir.",
			"costs":    buildFallbackCosts(weight, couriers),
		})
	}

	apiKey := getBiteshipKey()
	if apiKey == "" {
		return c.JSON(fiber.Map{
			"success":  true,
			"fallback": true,
			"warning":  "API Key Biteship belum dikonfigurasi. Menggunakan tarif estimasi.",
			"costs":    buildFallbackCosts(weight, couriers),
		})
	}

	cacheKey := fmt.Sprintf("%s_%s_%d_%s", originAreaID, destAreaID, weight, strings.ToLower(couriers))
	ratesCacheLock.RLock()
	if cached, ok := ratesCacheMap[cacheKey]; ok && time.Since(cached.timestamp) < config.RatesCacheTTL {
		ratesCacheLock.RUnlock()
		return c.JSON(fiber.Map{
			"success": true,
			"costs":   cached.costs,
		})
	}
	ratesCacheLock.RUnlock()

	biteshipReqPayload := map[string]interface{}{
		"origin_area_id":      originAreaID,
		"destination_area_id": destAreaID,
		"couriers":            couriers,
		"items": []map[string]interface{}{
			{
				"name":     "Produk MAMEKO",
				"value":    25000,
				"weight":   weight,
				"quantity": 1,
			},
		},
	}

	reqBytes, _ := json.Marshal(biteshipReqPayload)
	httpReq, err := http.NewRequest("POST", "https://api.biteship.com/v1/rates/couriers", bytes.NewBuffer(reqBytes))
	if err != nil {
		return c.JSON(fiber.Map{
			"success":  true,
			"fallback": true,
			"costs":    buildFallbackCosts(weight, couriers),
		})
	}

	httpReq.Header.Set("Authorization", apiKey)
	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil || resp.StatusCode != http.StatusOK {
		return c.JSON(fiber.Map{
			"success":  true,
			"fallback": true,
			"costs":    buildFallbackCosts(weight, couriers),
		})
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)
	var biteshipRatesResp struct {
		Success bool `json:"success"`
		Pricing []struct {
			Company            string  `json:"company"`
			CourierName        string  `json:"courier_name"`
			CourierCode        string  `json:"courier_code"`
			CourierServiceName string  `json:"courier_service_name"`
			CourierServiceCode string  `json:"courier_service_code"`
			Description        string  `json:"description"`
			Duration           string  `json:"duration"`
			Price              float64 `json:"price"`
			ServiceType        string  `json:"service_type"`
			Type               string  `json:"type"`
		} `json:"pricing"`
	}

	if err := json.Unmarshal(bodyBytes, &biteshipRatesResp); err != nil || len(biteshipRatesResp.Pricing) == 0 {
		return c.JSON(fiber.Map{
			"success":  true,
			"fallback": true,
			"costs":    buildFallbackCosts(weight, couriers),
		})
	}

	// Group pricing by courier code
	courierMap := make(map[string]fiber.Map)
	courierOrder := []string{}

	for _, p := range biteshipRatesResp.Pricing {
		cCode := strings.ToLower(p.CourierCode)
		if cCode == "" {
			cCode = strings.ToLower(p.Company)
		}
		cName := p.CourierName
		if cName == "" {
			cName = strings.ToUpper(cCode)
		}

		sCode := strings.ToUpper(p.CourierServiceCode)
		if sCode == "" {
			sCode = strings.ToUpper(p.Type)
		}

		sDesc := p.Description
		if sDesc == "" {
			sDesc = p.CourierServiceName
		}
		if sDesc == "" {
			sDesc = sCode
		}

		etd := strings.ReplaceAll(strings.ToLower(p.Duration), "hari", "")
		etd = strings.TrimSpace(etd)
		if etd == "" {
			etd = "1-3"
		}

		serviceItem := fiber.Map{
			"service":     sCode,
			"description": sDesc,
			"cost":        int(math.Round(p.Price)),
			"etd":         etd,
		}

		if existing, ok := courierMap[cCode]; ok {
			services := existing["services"].([]fiber.Map)
			existing["services"] = append(services, serviceItem)
		} else {
			courierMap[cCode] = fiber.Map{
				"courier":     cCode,
				"courierName": cName,
				"services":    []fiber.Map{serviceItem},
			}
			courierOrder = append(courierOrder, cCode)
		}
	}

	var formattedCosts []fiber.Map
	for _, code := range courierOrder {
		formattedCosts = append(formattedCosts, courierMap[code])
	}

	// Save to in-memory cache
	ratesCacheLock.Lock()
	ratesCacheMap[cacheKey] = ratesCacheEntry{
		costs:     formattedCosts,
		timestamp: time.Now(),
	}
	ratesCacheLock.Unlock()

	return c.JSON(fiber.Map{
		"success": true,
		"costs":   formattedCosts,
	})
}

// GetCities retrieves area list from Biteship Maps API (Backwards compatibility for /api/ongkir/cities)
func GetCities(c *fiber.Ctx) error {
	query := strings.TrimSpace(c.Query("query"))
	if query == "" {
		query = strings.TrimSpace(c.Query("q"))
	}

	c.Request().URI().SetQueryString(fmt.Sprintf("q=%s", query))
	return GetBiteshipAreas(c)
}
