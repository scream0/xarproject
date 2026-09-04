package controllers

import (
	"database/sql"
	"strings"
	"time"
	"xar-backend-go/internal/config"
	"xar-backend-go/internal/middleware"
	"xar-backend-go/internal/models"

	"github.com/gofiber/fiber/v2"
)

// GetUser retrieves profile details for a given userId
func GetUser(c *fiber.Ctx) error {
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

	query := `SELECT id, full_name, email, phone, role, avatar_url, created_at, updated_at FROM profiles WHERE id = $1 LIMIT 1`
	var p models.UserProfile
	var fName, email, phone, role, avatar sql.NullString
	var cAt, uAt sql.NullTime

	err = config.DB.QueryRow(query, targetUserID).Scan(
		&p.ID, &fName, &email, &phone, &role, &avatar, &cAt, &uAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return c.JSON(fiber.Map{"exists": false, "data": nil})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	if fName.Valid {
		p.FullName = &fName.String
	}
	if email.Valid {
		p.Email = &email.String
	} else if actor.ID == targetUserID && actor.Email != "" {
		p.Email = &actor.Email
	}
	if phone.Valid {
		p.Phone = &phone.String
	}
	if role.Valid && strings.TrimSpace(role.String) != "" {
		p.Role = role.String
	} else if actor.ID == targetUserID && actor.Role != "" {
		p.Role = actor.Role
	} else {
		p.Role = "user"
	}
	if avatar.Valid {
		p.AvatarURL = &avatar.String
	}
	if cAt.Valid {
		p.CreatedAt = &cAt.Time
	}
	if uAt.Valid {
		p.UpdatedAt = &uAt.Time
	}

	// Fetch user's claimed vouchers
	vRows, err := config.DB.Query(`
		SELECT 
			uv.id::text, uv.voucher_id::text, COALESCE(uv.status, 'active'), uv.created_at,
			v.code, v.title, v.type, v.discount_amount, v.min_purchase, v.valid_until, v.usage_limit, v.is_active
		FROM user_vouchers uv
		LEFT JOIN vouchers v ON uv.voucher_id::text = v.id::text
		WHERE uv.user_id::text = $1
		ORDER BY uv.created_at DESC
	`, targetUserID)
	if err == nil {
		defer vRows.Close()
		var uvList []map[string]interface{}
		for vRows.Next() {
			var claimID, voucherID, status string
			var createdAt *time.Time
			var code, title, vType sql.NullString
			var discountAmount, minPurchase sql.NullFloat64
			var validUntil *time.Time
			var usageLimit sql.NullInt64
			var isActive sql.NullBool

			if err := vRows.Scan(
				&claimID, &voucherID, &status, &createdAt,
				&code, &title, &vType, &discountAmount, &minPurchase, &validUntil, &usageLimit, &isActive,
			); err == nil {
				uvList = append(uvList, map[string]interface{}{
					"id":         claimID,
					"voucher_id": voucherID,
					"status":     status,
					"created_at": createdAt,
					"vouchers": map[string]interface{}{
						"id":              voucherID,
						"code":            code.String,
						"title":           title.String,
						"type":            vType.String,
						"discount_amount": discountAmount.Float64,
						"min_purchase":    minPurchase.Float64,
						"valid_until":     validUntil,
						"usage_limit":     usageLimit.Int64,
						"is_active":       isActive.Bool,
					},
				})
			}
		}
		if uvList == nil {
			uvList = []map[string]interface{}{}
		}
		p.UserVouchers = uvList
	} else {
		p.UserVouchers = []map[string]interface{}{}
	}

	return c.JSON(fiber.Map{"exists": true, "data": p})
}

// UpdateUser saves or updates profile details
func UpdateUser(c *fiber.Ctx) error {
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

	var req models.UpdateUserRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid JSON body"})
	}

	avatarURL := req.AvatarURL
	if avatarURL == nil {
		avatarURL = req.PhotoURL
	}

	query := `
		INSERT INTO profiles (
			id, full_name, phone, avatar_url, username, gender, birth_date, photo_url, photo_public_id,
			newsletter_subscribed, bank_name, bank_account_number, bank_account_name, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
		ON CONFLICT (id) DO UPDATE SET
			full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
			phone = COALESCE(EXCLUDED.phone, profiles.phone),
			avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
			username = COALESCE(EXCLUDED.username, profiles.username),
			gender = COALESCE(EXCLUDED.gender, profiles.gender),
			birth_date = COALESCE(EXCLUDED.birth_date, profiles.birth_date),
			photo_url = COALESCE(EXCLUDED.photo_url, profiles.photo_url),
			photo_public_id = COALESCE(EXCLUDED.photo_public_id, profiles.photo_public_id),
			newsletter_subscribed = COALESCE(EXCLUDED.newsletter_subscribed, profiles.newsletter_subscribed),
			bank_name = COALESCE(EXCLUDED.bank_name, profiles.bank_name),
			bank_account_number = COALESCE(EXCLUDED.bank_account_number, profiles.bank_account_number),
			bank_account_name = COALESCE(EXCLUDED.bank_account_name, profiles.bank_account_name),
			updated_at = NOW()
	`

	_, err = config.DB.Exec(query, 
		targetUserID, req.FullName, req.Phone, avatarURL, req.Username, req.Gender, req.BirthDate, req.PhotoURL,
		req.PhotoPublicID, req.NewsletterSubscribed, req.BankName, req.BankAccountNumber, req.BankAccountName,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update profile: " + err.Error()})
	}

	now := time.Now()
	return c.JSON(fiber.Map{
		"success": true,
		"data": models.UserProfile{
			ID:        targetUserID,
			FullName:  req.FullName,
			Phone:     req.Phone,
			Role:      actor.Role,
			AvatarURL: avatarURL,
			UpdatedAt: &now,
		},
	})
}

// DeleteUser deletes the current user profile (hapus akun secara permanen)
func DeleteUser(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	authHeader := c.Get("Authorization")
	actor, err := middleware.ParseSupabaseToken(authHeader)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	targetUserID := actor.ID

	// Delete from profiles
	_, err = config.DB.Exec("DELETE FROM profiles WHERE id::text = $1", targetUserID)
	if err != nil {
		if strings.Contains(err.Error(), "violates foreign key constraint") {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Akun tidak bisa dihapus karena masih terikat dengan riwayat pesanan."})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal menghapus profil: " + err.Error()})
	}

	return c.JSON(fiber.Map{"success": true, "message": "Akun berhasil dihapus secara permanen"})
}
