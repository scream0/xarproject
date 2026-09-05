package controllers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"
	"xar-backend-go/internal/config"
	"xar-backend-go/internal/middleware"
	"xar-backend-go/internal/models"
	"xar-backend-go/internal/services"

	"github.com/gofiber/fiber/v2"
)

// GetAdminOrders lists all orders with status tabs, search, and pagination
func GetAdminOrders(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	authHeader := c.Get("Authorization")
	user, err := middleware.ParseSupabaseToken(authHeader)
	if err != nil || (user.Role != "admin" && user.Role != "superadmin") {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Admin access required"})
	}

	status := strings.ToLower(strings.TrimSpace(c.Query("status")))
	search := strings.TrimSpace(c.Query("search"))
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	var whereClauses []string
	var args []interface{}
	argIdx := 1

	if status != "" && status != "all" {
		statusList := strings.Split(status, ",")
		var validStatuses []string
		for _, s := range statusList {
			sTrim := strings.TrimSpace(strings.ToLower(s))
			if sTrim != "" {
				validStatuses = append(validStatuses, sTrim)
			}
		}

		if len(validStatuses) == 1 {
			whereClauses = append(whereClauses, fmt.Sprintf("LOWER(status) = $%d", argIdx))
			args = append(args, validStatuses[0])
			argIdx++
		} else if len(validStatuses) > 1 {
			placeholders := make([]string, len(validStatuses))
			for i, st := range validStatuses {
				placeholders[i] = fmt.Sprintf("$%d", argIdx)
				args = append(args, st)
				argIdx++
			}
			whereClauses = append(whereClauses, fmt.Sprintf("LOWER(status) IN (%s)", strings.Join(placeholders, ", ")))
		}
	}

	if search != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("(order_number ILIKE $%d OR customer_name ILIKE $%d OR customer_email ILIKE $%d OR customer_phone ILIKE $%d OR id::text ILIKE $%d)", argIdx, argIdx, argIdx, argIdx, argIdx))
		args = append(args, "%"+search+"%")
		argIdx++
	}

	whereSQL := ""
	if len(whereClauses) > 0 {
		whereSQL = "WHERE " + strings.Join(whereClauses, " AND ")
	}

	// Count query
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM orders %s", whereSQL)
	var total int
	_ = config.DB.QueryRow(countQuery, args...).Scan(&total)

	// Data query
	query := fmt.Sprintf(`SELECT * FROM orders %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, whereSQL, argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := config.DB.Query(query, args...)
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
	if err := rows.Err(); err != nil {
		fmt.Println("Rows error AdminOrders:", err)
	}

	// Fetch items for all orders
	if len(orderIDs) > 0 {
		placeholders := make([]string, len(orderIDs))
		argsList := make([]interface{}, len(orderIDs))
		for i, id := range orderIDs {
			placeholders[i] = "$" + strconv.Itoa(i+1)
			argsList[i] = id
		}

		itemsQuery := fmt.Sprintf(`SELECT * FROM order_items WHERE order_id::text IN (%s)`, strings.Join(placeholders, ","))
		itemRows, err := config.DB.Query(itemsQuery, argsList...)
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
			if err := itemRows.Err(); err != nil {
				fmt.Println("itemRows error AdminOrders:", err)
			}

			for i := range orders {
				if itms, exists := itemsMap[orders[i].ID]; exists {
					orders[i].Items = itms
				}
			}
		}
	}

	totalPages := 1
	if limit > 0 {
		totalPages = (total + limit - 1) / limit
		if totalPages < 1 {
			totalPages = 1
		}
	}

	return c.JSON(fiber.Map{
		"orders": orders,
		"total":  total,
		"page":   page,
		"limit":  limit,
		"pagination": fiber.Map{
			"currentPage": page,
			"totalPages":  totalPages,
			"totalOrders": total,
			"limit":       limit,
		},
	})
}

// GetAdminOrderDetail returns single order for admin
func GetAdminOrderDetail(c *fiber.Ctx) error {
	return GetUserOrderDetail(c)
}

// UpdateAdminOrderShipping updates waybill receipt number and marks as shipped
func UpdateAdminOrderShipping(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	orderID := strings.TrimSpace(c.Params("id"))
	var req struct {
		ReceiptNumber  string `json:"receiptNumber"`
		TrackingNumber string `json:"trackingNumber"`
		CourierName    string `json:"courierName"`
		ServiceType    string `json:"serviceType"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	resi := strings.TrimSpace(req.ReceiptNumber)
	if resi == "" {
		resi = strings.TrimSpace(req.TrackingNumber)
	}
	if resi == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Nomor resi pengiriman wajib diisi"})
	}

	note := fmt.Sprintf("Resi manual diinput: %s (%s)", resi, req.CourierName)
	histEntry := map[string]interface{}{
		"status":    "shipped",
		"notes":     note,
		"actor":     "admin",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	}
	hBytes, _ := json.Marshal(histEntry)

	query := `
		UPDATE orders SET
			waybill_id = $1,
			shipping_receipt_number = $1,
			shipping_detail = jsonb_set(
				jsonb_set(
					jsonb_set(
						COALESCE(shipping_detail, '{}'::jsonb),
						'{tracking_number}',
						to_jsonb($1::text)
					),
					'{courier_name}',
					to_jsonb($2::text)
				),
				'{service_type}',
				to_jsonb($3::text)
			),
			status = 'shipped',
			status_history = COALESCE(status_history, '[]'::jsonb) || $4::jsonb,
			updated_at = NOW()
		WHERE id::text = $5 OR order_number = $5
	`

	_, err := config.DB.Exec(query, resi, req.CourierName, req.ServiceType, fmt.Sprintf("[%s]", string(hBytes)), orderID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"success": true, "message": "Shipping information updated", "trackingNumber": resi})
}

// UpdateAdminOrderStatus updates the order status
func UpdateAdminOrderStatus(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	orderID := strings.TrimSpace(c.Params("id"))
	var req struct {
		Status string `json:"status"`
		Notes  string `json:"notes"`
	}
	if err := c.BodyParser(&req); err != nil || req.Status == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Status is required"})
	}

	note := req.Notes
	if note == "" {
		note = fmt.Sprintf("Status diubah menjadi %s oleh admin", req.Status)
	}

	histEntry := map[string]interface{}{
		"status":      req.Status,
		"status_to":   req.Status,
		"notes":       note,
		"actor":       "admin",
		"actor_label": "Admin Toko",
		"timestamp":   time.Now().UTC().Format(time.RFC3339),
		"created_at":  time.Now().UTC().Format(time.RFC3339),
	}
	hBytes, _ := json.Marshal(histEntry)

	query := `
		UPDATE orders SET
			status = $1,
			status_history = COALESCE(status_history, '[]'::jsonb) || $2::jsonb,
			updated_at = NOW()
		WHERE id::text = $3 OR order_number = $3
	`

	_, err := config.DB.Exec(query, req.Status, fmt.Sprintf("[%s]", string(hBytes)), orderID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	// If cancelled by admin, delete any uploaded payment proof image from Cloudinary
	if req.Status == "cancelled" {
		var proofURL sql.NullString
		_ = config.DB.QueryRow(`SELECT COALESCE(shipping_detail->>'payment_proof_url', '') FROM orders WHERE id::text = $1 OR order_number = $1`, orderID).Scan(&proofURL)
		if proofURL.Valid && proofURL.String != "" {
			go services.DeleteCloudinaryImage(proofURL.String)
		}
	}

	return c.JSON(fiber.Map{"success": true, "status": req.Status})
}

// RunManualOrderAutomation triggers order automation manually by admin
func RunManualOrderAutomation(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	authHeader := c.Get("Authorization")
	user, err := middleware.ParseSupabaseToken(authHeader)
	if err != nil || (user.Role != "admin" && user.Role != "superadmin") {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Admin access required"})
	}

	res, err := services.RunOrderAutomation(config.DB)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": fmt.Sprintf("Otomasi selesai: %d pesanan dibatalkan (>24 jam), %d pesanan diselesaikan (>14 hari)", res.AutoCancelledCount, res.AutoCompleteCount),
		"data":    res,
	})
}
