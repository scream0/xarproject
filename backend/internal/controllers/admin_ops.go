package controllers

import (
	"database/sql"
	"fmt"
	"strings"
	"time"
	"xar-backend-go/internal/config"
	"xar-backend-go/internal/middleware"
	"xar-backend-go/internal/whatsapp"

	"github.com/gofiber/fiber/v2"
)

// GetAdminReturns returns all customer return requests
func GetAdminReturns(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	rows, err := config.DB.Query(`
		SELECT r.id, r.order_id, r.user_id, r.reason, r.evidence_url, r.status, r.admin_note, r.created_at,
		       p.bank_name, p.bank_account_number, p.bank_account_name, p.username, p.email, p.full_name
		FROM return_requests r
		LEFT JOIN profiles p ON r.user_id::text = p.id::text
		ORDER BY r.created_at DESC
	`)
	if err != nil {
		fmt.Println("Error in GetAdminReturns Query:", err)
		return c.JSON(fiber.Map{"returns": []interface{}{}})
	}
	defer rows.Close()

	returns := make([]map[string]interface{}, 0)
	for rows.Next() {
		var id, oID, uID, reason, status string
		var evidence, adminNote, bName, bNum, bHolder, username, email, fullName sql.NullString
		var cAt time.Time
		if err := rows.Scan(&id, &oID, &uID, &reason, &evidence, &status, &adminNote, &cAt, &bName, &bNum, &bHolder, &username, &email, &fullName); err == nil {
			// Use full_name first, then username, then email prefix as fallback
			displayName := fullName.String
			if displayName == "" {
				displayName = username.String
			}
			returns = append(returns, map[string]interface{}{
				"id":         id,
				"orderId":    oID,
				"userId":     uID,
				"reason":     reason,
				"evidence":   evidence.String,
				"status":     status,
				"adminNote":  adminNote.String,
				"bankName":   bName.String,
				"bankNumber": bNum.String,
				"bankHolder": bHolder.String,
				"username":   displayName,
				"email":      email.String,
				"createdAt":  cAt,
			})
		} else {
			fmt.Println("Scan error AdminReturns:", err)
		}
	}

	return c.JSON(fiber.Map{"returns": returns})
}

// UpdateAdminReturn updates return status (approved / rejected)
func UpdateAdminReturn(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	id := strings.TrimSpace(c.Params("id"))
	var req struct {
		Action    string `json:"action"`    // "approve" or "reject"
		AdminNote string `json:"admin_note"`
		Status    string `json:"status"`    // fallback
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// Determine new status from action or status field
	newStatus := req.Status
	if req.Action == "approve" {
		newStatus = "approved"
	} else if req.Action == "reject" {
		newStatus = "rejected"
	}

	if newStatus == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Action or status is required"})
	}

	// Get the order_id and user_id associated with this return request
	var orderID, userID string
	err := config.DB.QueryRow(`SELECT order_id, user_id FROM return_requests WHERE id::text = $1`, id).Scan(&orderID, &userID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Return request not found"})
	}

	// Update return_requests with new status and admin_note
	_, err = config.DB.Exec(
		`UPDATE return_requests SET status = $1, admin_note = $2, updated_at = NOW() WHERE id::text = $3`,
		newStatus, req.AdminNote, id,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	// Also update the order status to match
	orderStatus := "return_requested"
	historyNote := "Status retur diperbarui."
	userNotificationMsg := ""
	
	if newStatus == "approved" {
		orderStatus = "returned"
		historyNote = "Pengajuan return disetujui oleh admin."
		
		// Wallet Refund Logic
		// Get total_amount from orders
		var totalAmount float64
		_ = config.DB.QueryRow(`SELECT total_amount FROM orders WHERE id::text = $1`, orderID).Scan(&totalAmount)

		// Insert into wallet_transactions as refund
		txQuery := `INSERT INTO wallet_transactions (wallet_id, amount, type, description, reference_id, created_at, updated_at) 
					VALUES ($1, $2, 'refund', $3, $4, NOW(), NOW())`
		_, errTx := config.DB.Exec(txQuery, userID, totalAmount, "Refund pesanan "+orderID, orderID)

		if errTx == nil {
			// Update or create wallet balance
			_, _ = config.DB.Exec(`
				INSERT INTO wallets (user_id, balance, created_at, updated_at)
				VALUES ($1, $2, NOW(), NOW())
				ON CONFLICT (user_id) 
				DO UPDATE SET balance = wallets.balance + EXCLUDED.balance, updated_at = NOW()
			`, userID, totalAmount)
		}

		userNotificationMsg = fmt.Sprintf("Pengajuan return pesanan Anda (%s) telah disetujui. Dana sebesar Rp%v telah dikembalikan ke Mameko Wallet Anda.", orderID, totalAmount)
		
	} else if newStatus == "rejected" {
		orderStatus = "delivered" // revert to delivered if rejected
		historyNote = "Pengajuan return ditolak oleh admin."
		userNotificationMsg = fmt.Sprintf("Pengajuan return pesanan Anda (%s) ditolak. Alasan: %s", orderID, req.AdminNote)
	}

	// Fetch User WhatsApp Number
	var userPhone sql.NullString
	_ = config.DB.QueryRow(`SELECT whatsapp_number FROM profiles WHERE id::text = $1`, userID).Scan(&userPhone)

	// Send WhatsApp Notification to User
	if userPhone.Valid && userPhone.String != "" {
		waMsg := fmt.Sprintf("Halo! 📦 *Update Status Retur*\n\nPesanan: %s\nStatus: *%s*\n\n%s", orderID, strings.ToUpper(newStatus), userNotificationMsg)
		go whatsapp.SendMessage(userPhone.String, waMsg)
	}

	// Insert User Notification
	if userNotificationMsg != "" {
		_, _ = config.DB.Exec(`
			INSERT INTO notifications (user_id, title, message, audience, link, created_at, updated_at)
			VALUES ($1, $2, $3, 'user', $4, NOW(), NOW())
		`, userID, "Update Status Retur", userNotificationMsg, "/dashboard/orders")
	}

	historyJSON := fmt.Sprintf(`[{"status_to": "%s", "actor": "admin", "actor_label": "Admin MAMEKO", "notes": "%s", "created_at": "%s"}]`, orderStatus, historyNote, time.Now().Format(time.RFC3339))
	
	_, _ = config.DB.Exec(
		`UPDATE orders SET status = $1, status_history = COALESCE(status_history, '[]'::jsonb) || $2::jsonb, updated_at = NOW() WHERE id::text = $3`,
		orderStatus, historyJSON, orderID,
	)

	return c.JSON(fiber.Map{"success": true, "message": "Return request updated to " + newStatus})
}


// GetAdminWithdrawals lists all pending and completed withdrawal requests
func GetAdminWithdrawals(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	rows, err := config.DB.Query(`
		SELECT id, user_id, amount, bank_name, account_number, account_holder, status, created_at, updated_at
		FROM withdrawals
		ORDER BY created_at DESC
	`)
	if err != nil {
		return c.JSON(fiber.Map{"withdrawals": []interface{}{}})
	}
	defer rows.Close()

	withdrawals := make([]map[string]interface{}, 0)
	for rows.Next() {
		var id, uID, bank, accNum, accHolder, status string
		var amount float64
		var cAt, uAt time.Time
		if err := rows.Scan(&id, &uID, &amount, &bank, &accNum, &accHolder, &status, &cAt, &uAt); err == nil {
			withdrawals = append(withdrawals, map[string]interface{}{
				"id":            id,
				"userId":        uID,
				"amount":        amount,
				"bankName":      bank,
				"accountNumber": accNum,
				"accountHolder": accHolder,
				"status":        status,
				"createdAt":     cAt,
				"updatedAt":     uAt,
			})
		}
	}

	return c.JSON(fiber.Map{"withdrawals": withdrawals})
}

// UpdateAdminWithdrawal approves or rejects a withdrawal request
func UpdateAdminWithdrawal(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	id := strings.TrimSpace(c.Params("id"))
	var req struct {
		Action      string `json:"action"`
		Description string `json:"description"`
		Status      string `json:"status"` // fallback
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	newStatus := req.Status
	if req.Action == "approve" {
		newStatus = "completed"
	} else if req.Action == "reject" {
		newStatus = "rejected"
	}

	if newStatus == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Action or status is required"})
	}

	// Get user_id and amount from withdrawals
	var userID string
	var amount float64
	err := config.DB.QueryRow(`SELECT user_id, amount FROM withdrawals WHERE id::text = $1`, id).Scan(&userID, &amount)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Withdrawal request not found"})
	}

	_, err = config.DB.Exec(`UPDATE withdrawals SET status = $1, updated_at = NOW() WHERE id::text = $2`, newStatus, id)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	// Send notification
	notifMsg := ""
	if newStatus == "completed" {
		notifMsg = fmt.Sprintf("Penarikan dana sebesar Rp%v telah berhasil ditransfer ke rekening Anda. %s", amount, req.Description)
	} else if newStatus == "rejected" {
		notifMsg = fmt.Sprintf("Penarikan dana sebesar Rp%v ditolak. Alasan: %s", amount, req.Description)
	}

	if notifMsg != "" {
		_, _ = config.DB.Exec(`
			INSERT INTO notifications (user_id, title, message, audience, link, created_at, updated_at)
			VALUES ($1, $2, $3, 'user', $4, NOW(), NOW())
		`, userID, "Info Penarikan Dana", notifMsg, "/dashboard/wallet")
	}

	return c.JSON(fiber.Map{"success": true, "message": "Withdrawal request updated"})
}

// GetTeamMembers lists all users
func GetTeamMembers(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	rows, err := config.DB.Query(`
		SELECT 
			p.id, 
			COALESCE(p.full_name, (au.raw_user_meta_data->>'name')::text, (au.raw_user_meta_data->>'full_name')::text, au.email) as full_name, 
			COALESCE(p.email, au.email) as email, 
			COALESCE(p.role, 'customer') as role, 
			COALESCE(p.status, 'active') as status, 
			COALESCE(p.created_at, au.created_at) as created_at,
			COALESCE(SUM(o.total_amount), 0) as total_spent,
			COUNT(o.id) as total_orders,
			COALESCE(w.balance, 0) as points
		FROM profiles p
		LEFT JOIN auth.users au ON p.id::text = au.id::text
		LEFT JOIN wallets w ON p.id::text = w.user_id::text
		LEFT JOIN orders o ON p.id::text = o.user_id::text AND o.status IN ('paid', 'shipped', 'delivered', 'completed')
		GROUP BY p.id, au.raw_user_meta_data, au.email, au.created_at, w.balance
		ORDER BY created_at DESC
	`)
	if err != nil {
		fmt.Println("GetTeamMembers DB Query Error:", err)
		return c.JSON(fiber.Map{"users": []interface{}{}})
	}
	defer rows.Close()

	team := make([]map[string]interface{}, 0)
	for rows.Next() {
		var id string
		var fName, email, role, status sql.NullString
		var cAt sql.NullTime
		var totalSpent float64
		var totalOrders int
		var points float64
		if err := rows.Scan(&id, &fName, &email, &role, &status, &cAt, &totalSpent, &totalOrders, &points); err == nil {
			roleStr := role.String
			if roleStr == "" {
				roleStr = "customer"
			}
			var createdAt time.Time
			if cAt.Valid {
				createdAt = cAt.Time
			} else {
				createdAt = time.Now()
			}
			
			statusStr := status.String
			if statusStr == "" {
				statusStr = "active"
			}
			
			team = append(team, map[string]interface{}{
				"id":          id,
				"name":        fName.String,
				"email":       email.String,
				"role":        roleStr,
				"status":      statusStr,
				"createdAt":   createdAt,
				"totalSpent":  totalSpent,
				"totalOrders": totalOrders,
				"points":      points,
			})
		} else {
			fmt.Println("GetTeamMembers Scan Error:", err)
		}
	}

	fmt.Println("GetTeamMembers returning team length:", len(team))
	return c.JSON(fiber.Map{"users": team})
}

// CreateTeamMember invites or adds a team member
func CreateTeamMember(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"success": true, "message": "Team member registered"})
}

// UpdateTeamMember updates a team member's role or status
func UpdateTeamMember(c *fiber.Ctx) error {
	type UpdatePayload struct {
		UserID string `json:"userId"`
		Role   string `json:"role"`
		Status string `json:"status"`
	}
	var payload UpdatePayload
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}

	if payload.UserID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "userId is required"})
	}

	// Prevent user from modifying themselves
	user, ok := c.Locals("user").(*middleware.AuthUser)
	if ok && user != nil && user.ID == payload.UserID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Admin tidak dapat mengubah status akunnya sendiri."})
	}

	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	// Build update query dynamically
	updates := []string{}
	args := []interface{}{}
	argId := 1

	if payload.Role != "" {
		updates = append(updates, fmt.Sprintf("role = $%d", argId))
		args = append(args, payload.Role)
		argId++
	}
	if payload.Status != "" {
		updates = append(updates, fmt.Sprintf("status = $%d", argId))
		args = append(args, payload.Status)
		argId++
	}

	if len(updates) == 0 {
		return c.JSON(fiber.Map{"success": true, "message": "No changes requested"})
	}

	args = append(args, payload.UserID)
	query := fmt.Sprintf(`UPDATE profiles SET %s WHERE id = $%d`, strings.Join(updates, ", "), argId)

	_, err := config.DB.Exec(query, args...)
	if err != nil {
		fmt.Println("UpdateTeamMember Error:", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update user"})
	}

	return c.JSON(fiber.Map{"success": true, "message": "User updated"})
}

// DeleteTeamMember deactivates or removes a user/team member
func DeleteTeamMember(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	authHeader := c.Get("Authorization")
	user, err := middleware.ParseSupabaseToken(authHeader)
	if err != nil || (user.Role != "admin" && user.Role != "superadmin") {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Admin access required"})
	}

	targetUserID := c.Query("userId")
	if targetUserID == "" {
		targetUserID = c.Query("id")
	}
	if targetUserID == "" {
		targetUserID = c.Params("id")
	}
	if targetUserID == "" {
		var req struct {
			UserID string `json:"userId"`
			ID     string `json:"id"`
		}
		_ = c.BodyParser(&req)
		targetUserID = req.UserID
		if targetUserID == "" {
			targetUserID = req.ID
		}
	}

	if targetUserID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "userId is required"})
	}

	if user.ID == targetUserID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Admin tidak dapat menghapus akunnya sendiri."})
	}

	_, err = config.DB.Exec(`UPDATE profiles SET status = 'inactive', updated_at = NOW() WHERE id::text = $1`, targetUserID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal menonaktifkan pengguna: " + err.Error()})
	}

	return c.JSON(fiber.Map{"success": true, "message": "Pengguna berhasil dinonaktifkan"})
}

// GetProcurement lists stock procurement logs
func GetProcurement(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"success": true, "items": []interface{}{}})
}

// CreateProcurement creates a new procurement batch
func CreateProcurement(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"success": true, "message": "Procurement recorded"})
}

// UpdateProcurement updates procurement batch status
func UpdateProcurement(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"success": true, "message": "Procurement updated"})
}

// DeleteProcurement deletes procurement batch
func DeleteProcurement(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"success": true, "message": "Procurement deleted"})
}

// GetReconciliation returns revenue and reconciliation metrics
func GetReconciliation(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	var totalRevenue float64
	var totalOrders int
	_ = config.DB.QueryRow(`SELECT COALESCE(SUM(total_amount), 0), COUNT(*) FROM orders WHERE status IN ('paid', 'shipped', 'delivered', 'completed')`).Scan(&totalRevenue, &totalOrders)

	return c.JSON(fiber.Map{
		"success":      true,
		"totalRevenue": totalRevenue,
		"totalOrders":  totalOrders,
	})
}
