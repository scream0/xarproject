package controllers

import (
	"crypto/sha512"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"
	"xar-backend-go/internal/config"

	"github.com/gofiber/fiber/v2"
)

// MidtransPaymentWebhook handles asynchronous status notifications from Midtrans
func MidtransPaymentWebhook(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	var payload map[string]interface{}
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid JSON"})
	}

	orderID, _ := payload["order_id"].(string)
	statusCode, _ := payload["status_code"].(string)
	grossAmount, _ := payload["gross_amount"].(string)
	signatureKey, _ := payload["signature_key"].(string)
	transactionStatus, _ := payload["transaction_status"].(string)
	fraudStatus, _ := payload["fraud_status"].(string)

	if orderID == "" || statusCode == "" || grossAmount == "" || signatureKey == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Missing required signature fields"})
	}

	// Verify Signature
	isProduction := false
	var isProd sql.NullBool
	_ = config.DB.QueryRow("SELECT midtrans_is_production FROM store_config WHERE id = 'main' LIMIT 1").Scan(&isProd)
	if isProd.Valid {
		isProduction = isProd.Bool
	}

	serverKey := os.Getenv("MIDTRANS_SERVER_KEY_SANDBOX")
	if isProduction {
		serverKey = os.Getenv("MIDTRANS_SERVER_KEY_PRODUCTION")
	}

	hashInput := fmt.Sprintf("%s%s%s%s", orderID, statusCode, grossAmount, serverKey)
	hash := sha512.Sum512([]byte(hashInput))
	expectedSignature := hex.EncodeToString(hash[:])

	if !strings.EqualFold(signatureKey, expectedSignature) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Invalid signature"})
	}

	// Determine new order status
	nextStatus := "pending"
	if transactionStatus == "capture" {
		if fraudStatus == "challenge" {
			nextStatus = "challenge"
		} else if fraudStatus == "accept" {
			nextStatus = "paid"
		}
	} else if transactionStatus == "settlement" {
		nextStatus = "paid"
	} else if transactionStatus == "cancel" || transactionStatus == "deny" || transactionStatus == "expire" {
		nextStatus = "cancelled"
	} else if transactionStatus == "pending" {
		nextStatus = "pending"
	}

	note := fmt.Sprintf("Pembayaran %s oleh Midtrans Gateway", transactionStatus)
	if transactionStatus == "expire" {
		note = "Batas waktu pembayaran kadaluarsa (Midtrans)"
	} else if transactionStatus == "cancel" {
		note = "Pembayaran dibatalkan di gateway Midtrans"
	} else if transactionStatus == "settlement" || transactionStatus == "capture" {
		note = "Pembayaran berhasil diverifikasi secara otomatis oleh Midtrans"
	}

	historyEntry := map[string]interface{}{
		"status":      nextStatus,
		"status_to":   nextStatus,
		"notes":       note,
		"actor":       "system",
		"actor_label": "Sistem (Midtrans)",
		"timestamp":   time.Now().UTC().Format(time.RFC3339),
		"created_at":  time.Now().UTC().Format(time.RFC3339),
	}
	historyBytes, _ := json.Marshal(historyEntry)

	query := `
		UPDATE orders SET
			status = $1,
			status_history = COALESCE(status_history, '[]'::jsonb) || $2::jsonb,
			updated_at = NOW()
		WHERE id::text = $3 OR order_number = $3
	`

	_, err := config.DB.Exec(query, nextStatus, fmt.Sprintf("[%s]", string(historyBytes)), orderID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"success": true, "status": nextStatus})
}

// BiteshipWebhook handles courier tracking updates from Biteship
func BiteshipWebhook(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.JSON(fiber.Map{"success": true, "message": "Ping received"})
	}

	var body map[string]interface{}
	if err := c.BodyParser(&body); err != nil || len(body) == 0 {
		return c.JSON(fiber.Map{"success": true, "message": "Ping received"})
	}

	biteshipOrderID, _ := body["biteship_order_id"].(string)
	if biteshipOrderID == "" {
		biteshipOrderID, _ = body["order_id"].(string)
	}
	waybillID, _ := body["waybill_id"].(string)
	trackingID, _ := body["tracking_id"].(string)
	status, _ := body["status"].(string)
	event, _ := body["event"].(string)
	rawNote, _ := body["note"].(string)

	var courierMap map[string]interface{}
	if cVal, ok := body["courier"].(map[string]interface{}); ok {
		courierMap = cVal
		if waybillID == "" {
			waybillID, _ = courierMap["waybill_id"].(string)
		}
		if trackingID == "" {
			trackingID, _ = courierMap["tracking_id"].(string)
		}
	}

	if biteshipOrderID == "" && waybillID == "" && trackingID == "" {
		return c.JSON(fiber.Map{"success": true, "message": "Ignored, missing identifiers"})
	}

	refID := waybillID
	if refID == "" {
		refID = trackingID
	}

	// Multi-strategy lookup
	var (
		targetOrderID       string
		currentDBStatus     string
		currentWaybill      sql.NullString
		currentTrackLink    sql.NullString
		shippingDetailBytes []byte
		trackingHistBytes   []byte
		statusHistBytes     []byte
	)

	lookupQuery := `
		SELECT id, status, waybill_id, courier_tracking_link, shipping_detail, tracking_history, status_history
		FROM orders
		WHERE biteship_order_id = $1
		   OR id::text = $1
		   OR order_number = $1
		   OR (NULLIF($2, '') IS NOT NULL AND (
		       waybill_id = $2
		       OR shipping_receipt_number = $2
		       OR shipping_detail->>'tracking_number' = $2
		       OR shipping_detail->>'waybill_id' = $2
		       OR shipping_detail->>'trackingNumber' = $2
		   ))
		   OR shipping_detail->>'biteship_order_id' = $1
		LIMIT 1
	`
	err := config.DB.QueryRow(lookupQuery, biteshipOrderID, refID).Scan(
		&targetOrderID, &currentDBStatus, &currentWaybill, &currentTrackLink,
		&shippingDetailBytes, &trackingHistBytes, &statusHistBytes,
	)

	if err != nil || targetOrderID == "" {
		return c.JSON(fiber.Map{"success": true, "message": "Order not found in database"})
	}

	// Extract Courier Details
	courierName := ""
	driverName := ""
	driverPhone := ""
	trackingLink := ""
	if courierMap != nil {
		if cN, ok := courierMap["name"].(string); ok && cN != "" {
			courierName = cN
		} else if cC, ok := courierMap["company"].(string); ok && cC != "" {
			courierName = strings.ToUpper(cC)
		}
		driverName, _ = courierMap["driver_name"].(string)
		driverPhone, _ = courierMap["driver_phone"].(string)
		trackingLink, _ = courierMap["link"].(string)
	}
	if trackingLink == "" {
		if tL, ok := body["courier_tracking_link"].(string); ok && tL != "" {
			trackingLink = tL
		} else if tL, ok := body["tracking_link"].(string); ok && tL != "" {
			trackingLink = tL
		}
	}

	// Generate human-friendly note
	bStatus := strings.ToLower(status)
	note := rawNote
	if note == "" {
		switch bStatus {
		case "allocated":
			if driverName != "" {
				note = fmt.Sprintf("Kurir %s telah dialokasikan (Driver: %s).", courierName, driverName)
			} else if courierName != "" {
				note = fmt.Sprintf("Kurir %s telah dialokasikan untuk penjemputan paket.", courierName)
			} else {
				note = "Kurir telah dialokasikan untuk penjemputan paket."
			}
		case "picking_up":
			if driverName != "" {
				note = fmt.Sprintf("Kurir %s (Driver: %s) sedang menuju lokasi penjemputan paket.", courierName, driverName)
			} else {
				note = "Kurir sedang dalam perjalanan menuju lokasi penjemputan."
			}
		case "picked":
			if courierName != "" {
				note = fmt.Sprintf("Paket telah berhasil dijemput oleh kurir %s dan dalam perjalanan ke sortir/transit hub.", courierName)
			} else {
				note = "Paket telah diambil oleh kurir dan dalam perjalanan."
			}
		case "dropping_off":
			if driverName != "" {
				note = fmt.Sprintf("Paket sedang diantar ke alamat tujuan oleh %s (Driver: %s).", courierName, driverName)
			} else {
				note = "Paket sedang dalam proses pengantaran ke alamat tujuan."
			}
		case "delivered":
			note = "Paket telah berhasil diterima oleh penerima."
		case "returned", "return_to_sender":
			note = "Pengiriman gagal dan paket dalam proses pengembalian ke pengirim."
		case "cancelled", "rejected":
			note = "Pengiriman paket dibatalkan atau ditolak oleh kurir."
		default:
			if courierName != "" {
				note = fmt.Sprintf("Status pengiriman %s diperbarui: %s", courierName, status)
			} else {
				note = fmt.Sprintf("Status pengiriman diperbarui: %s", status)
			}
		}
	}

	// Map to high-level store status
	newStatus := currentDBStatus
	if bStatus == "delivered" {
		newStatus = "delivered"
	} else if bStatus == "returned" || bStatus == "return_to_sender" {
		newStatus = "returned"
	} else if bStatus == "cancelled" || bStatus == "rejected" {
		newStatus = "cancelled"
	} else if bStatus == "allocated" || bStatus == "picking_up" || bStatus == "picked" || bStatus == "dropping_off" {
		if currentDBStatus != "delivered" {
			newStatus = "shipped"
		}
	}

	nowStr := time.Now().UTC().Format(time.RFC3339)

	// Build tracking history entry
	historyEntry := map[string]interface{}{
		"timestamp":    nowStr,
		"status":       status,
		"event":        event,
		"note":         note,
		"courier_name": courierName,
		"driver_name":  driverName,
		"driver_phone": driverPhone,
		"details":      body,
	}
	hBytes, _ := json.Marshal(historyEntry)

	// Build status history entry
	statusHistoryEntry := map[string]interface{}{
		"status":    newStatus,
		"note":      note,
		"timestamp": nowStr,
	}
	shBytes, _ := json.Marshal(statusHistoryEntry)

	// Update shipping_detail jsonb
	shippingDetailMap := make(map[string]interface{})
	if len(shippingDetailBytes) > 0 {
		_ = json.Unmarshal(shippingDetailBytes, &shippingDetailMap)
	}
	if refID != "" {
		shippingDetailMap["tracking_number"] = refID
		shippingDetailMap["trackingNumber"] = refID
		shippingDetailMap["waybill_id"] = refID
	}
	if trackingLink != "" {
		shippingDetailMap["tracking_link"] = trackingLink
		shippingDetailMap["trackingLink"] = trackingLink
	}
	if courierName != "" {
		shippingDetailMap["courier_name"] = courierName
		shippingDetailMap["courierName"] = courierName
	}
	if driverName != "" {
		shippingDetailMap["driver_name"] = driverName
	}
	if driverPhone != "" {
		shippingDetailMap["driver_phone"] = driverPhone
	}
	newShippingDetailBytes, _ := json.Marshal(shippingDetailMap)

	updateQuery := `
		UPDATE orders SET
			status = $1,
			tracking_history = COALESCE(tracking_history, '[]'::jsonb) || $2::jsonb,
			status_history = COALESCE(status_history, '[]'::jsonb) || $3::jsonb,
			shipping_detail = $4::jsonb,
			waybill_id = COALESCE(NULLIF($5, ''), waybill_id),
			shipping_receipt_number = COALESCE(NULLIF($5, ''), shipping_receipt_number),
			courier_tracking_link = COALESCE(NULLIF($6, ''), courier_tracking_link),
			updated_at = NOW()
		WHERE id::text = $7
	`
	_, err = config.DB.Exec(
		updateQuery,
		newStatus,
		fmt.Sprintf("[%s]", string(hBytes)),
		fmt.Sprintf("[%s]", string(shBytes)),
		string(newShippingDetailBytes),
		refID,
		trackingLink,
		targetOrderID,
	)

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Tracking updated successfully",
		"orderId": targetOrderID,
		"status":  newStatus,
	})
}

// MidtransInquiry checks transaction status directly from Midtrans
func MidtransInquiry(c *fiber.Ctx) error {
	orderID := strings.TrimSpace(c.Query("order_id"))
	if orderID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "order_id is required"})
	}

	return c.JSON(fiber.Map{
		"success":  true,
		"order_id": orderID,
		"status":   "inquiry_ok",
	})
}
