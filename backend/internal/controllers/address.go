package controllers

import (
	"database/sql"
	"strings"
	"xar-backend-go/internal/config"
	"xar-backend-go/internal/middleware"
	"xar-backend-go/internal/models"

	"github.com/gofiber/fiber/v2"
)

// GetAddresses returns address list for a user
func GetAddresses(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	authHeader := c.Get("Authorization")
	user, err := middleware.ParseSupabaseToken(authHeader)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	targetUserID := strings.TrimSpace(c.Params("userId"))
	if targetUserID == "" {
		targetUserID = user.ID
	}

	isAdmin := user.Role == "admin" || user.Role == "superadmin"
	if user.ID != targetUserID && !isAdmin {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden"})
	}

	query := `
		SELECT id, user_id, recipient_name, recipient_phone, street, city,
		       COALESCE(city_id, ''), province, COALESCE(postal_code, ''),
		       label, is_primary, created_at, updated_at
		FROM addresses
		WHERE user_id::text = $1
		ORDER BY is_primary DESC, created_at DESC
	`

	rows, err := config.DB.Query(query, targetUserID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	addresses := make([]models.Address, 0)
	for rows.Next() {
		var a models.Address
		var cAt, uAt sql.NullTime

		err := rows.Scan(
			&a.ID, &a.UserID, &a.RecipientName, &a.RecipientPhone, &a.Street, &a.City,
			&a.CityID, &a.Province, &a.PostalCode,
			&a.Label, &a.IsPrimary, &cAt, &uAt,
		)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}

		if cAt.Valid {
			a.CreatedAt = &cAt.Time
		}
		if uAt.Valid {
			a.UpdatedAt = &uAt.Time
		}

		addresses = append(addresses, a)
	}

	return c.JSON(addresses)
}

// CreateAddress adds a new shipping address
func CreateAddress(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	authHeader := c.Get("Authorization")
	user, err := middleware.ParseSupabaseToken(authHeader)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	targetUserID := strings.TrimSpace(c.Params("userId"))
	if targetUserID == "" {
		targetUserID = user.ID
	}

	isAdmin := user.Role == "admin" || user.Role == "superadmin"
	if user.ID != targetUserID && !isAdmin {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden"})
	}

	var req models.UpsertAddressRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.RecipientName == "" || req.RecipientPhone == "" || req.Street == "" || req.City == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Missing required fields"})
	}

	if req.Label == "" {
		req.Label = "Rumah"
	}

	if req.IsPrimary {
		_, _ = config.DB.Exec("UPDATE addresses SET is_primary = false WHERE user_id = $1", targetUserID)
	}

	query := `
		INSERT INTO addresses (
			user_id, recipient_name, recipient_phone, street, city,
			city_id, province, postal_code, label, is_primary, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5,
			$6, $7, $8, $9, $10, NOW(), NOW()
		)
		RETURNING id
	`

	var newID string
	err = config.DB.QueryRow(
		query,
		targetUserID, req.RecipientName, req.RecipientPhone, req.Street, req.City,
		req.CityID, req.Province, req.PostalCode, req.Label, req.IsPrimary,
	).Scan(&newID)

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create address: " + err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(models.Address{
		ID:             newID,
		UserID:         targetUserID,
		RecipientName:  req.RecipientName,
		RecipientPhone: req.RecipientPhone,
		Street:         req.Street,
		City:           req.City,
		CityID:         req.CityID,
		Province:       req.Province,
		PostalCode:     req.PostalCode,
		Label:          req.Label,
		IsPrimary:      req.IsPrimary,
	})
}

// UpdateAddress updates an existing address
func UpdateAddress(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	authHeader := c.Get("Authorization")
	user, err := middleware.ParseSupabaseToken(authHeader)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	targetUserID := strings.TrimSpace(c.Params("userId"))
	if targetUserID == "" {
		targetUserID = user.ID
	}
	addressID := strings.TrimSpace(c.Params("addressId"))
	if addressID == "" {
		addressID = strings.TrimSpace(c.Params("id"))
	}

	isAdmin := user.Role == "admin" || user.Role == "superadmin"
	if user.ID != targetUserID && !isAdmin {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden"})
	}

	var req models.UpsertAddressRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.IsPrimary {
		_, _ = config.DB.Exec("UPDATE addresses SET is_primary = false WHERE user_id = $1", targetUserID)
	}

	query := `
		UPDATE addresses SET
			recipient_name = $1, recipient_phone = $2, street = $3, city = $4,
			city_id = $5, province = $6, postal_code = $7, label = $8,
			is_primary = $9, updated_at = NOW()
		WHERE id::text = $10 AND user_id::text = $11
	`

	res, err := config.DB.Exec(
		query,
		req.RecipientName, req.RecipientPhone, req.Street, req.City,
		req.CityID, req.Province, req.PostalCode, req.Label,
		req.IsPrimary, addressID, targetUserID,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	if affected, _ := res.RowsAffected(); affected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Address not found"})
	}

	return c.JSON(models.Address{
		ID:             addressID,
		UserID:         targetUserID,
		RecipientName:  req.RecipientName,
		RecipientPhone: req.RecipientPhone,
		Street:         req.Street,
		City:           req.City,
		CityID:         req.CityID,
		Province:       req.Province,
		PostalCode:     req.PostalCode,
		Label:          req.Label,
		IsPrimary:      req.IsPrimary,
	})
}

// DeleteAddress deletes an address
func DeleteAddress(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	authHeader := c.Get("Authorization")
	user, err := middleware.ParseSupabaseToken(authHeader)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	targetUserID := strings.TrimSpace(c.Params("userId"))
	if targetUserID == "" {
		targetUserID = user.ID
	}
	addressID := strings.TrimSpace(c.Params("addressId"))
	if addressID == "" {
		addressID = strings.TrimSpace(c.Params("id"))
	}

	isAdmin := user.Role == "admin" || user.Role == "superadmin"
	if user.ID != targetUserID && !isAdmin {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden"})
	}

	_, err = config.DB.Exec("DELETE FROM addresses WHERE id::text = $1 AND user_id::text = $2", addressID, targetUserID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"success": true, "message": "Address deleted"})
}
