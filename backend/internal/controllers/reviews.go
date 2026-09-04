package controllers

import (
	"database/sql"
	"fmt"
	"strconv"
	"strings"
	"xar-backend-go/internal/config"
	"xar-backend-go/internal/middleware"
	"xar-backend-go/internal/models"

	"github.com/gofiber/fiber/v2"
)

// GetReviews handles listing public reviews or admin review moderation list
func GetReviews(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Database not initialized",
		})
	}

	all := c.Query("all") == "true"
	productID := strings.TrimSpace(c.Query("productId"))
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	// Check if caller is admin
	isAdmin := false
	authHeader := c.Get("Authorization")
	if authHeader != "" {
		if user, err := middleware.ParseSupabaseToken(authHeader); err == nil && (user.Role == "admin" || user.Role == "superadmin") {
			isAdmin = true
		}
	}

	// If all=true or admin caller without public filter, return full moderation view
	if all || isAdmin {
		query := `
			SELECT id, user_id, order_id, product_id, user_name, product_name,
			       rating, comment, review_photo, COALESCE(approved, true) as approved, created_at, updated_at
			FROM reviews
			ORDER BY created_at DESC
			LIMIT $1 OFFSET $2
		`
		rows, err := config.DB.Query(query, limit, offset)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}
		defer rows.Close()

		reviews := make([]models.Review, 0)
		for rows.Next() {
			var r models.Review
			var uID, oID, pName, photo sql.NullString
			var app bool
			var cAt, uAt sql.NullTime

			err := rows.Scan(
				&r.ID, &uID, &oID, &r.ProductID, &r.UserName, &pName,
				&r.Rating, &r.Comment, &photo, &app, &cAt, &uAt,
			)
			if err != nil {
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
			}

			if uID.Valid {
				r.UserID = &uID.String
			}
			if oID.Valid {
				r.OrderID = &oID.String
			}
			if pName.Valid {
				r.ProductName = &pName.String
			}
			if photo.Valid {
				r.ReviewPhoto = &photo.String
			}
			r.Approved = &app
			if cAt.Valid {
				r.CreatedAt = &cAt.Time
			}
			if uAt.Valid {
				r.UpdatedAt = &uAt.Time
			}

			reviews = append(reviews, r)
		}

		return c.JSON(fiber.Map{"reviews": reviews})
	}

	// Public reviews (only approved)
	var whereClauses []string
	var args []interface{}
	argIdx := 1

	whereClauses = append(whereClauses, "(approved = true OR approved IS NULL)")

	if productID != "" {
		whereClauses = append(whereClauses, "product_id::text = $"+strconv.Itoa(argIdx))
		args = append(args, productID)
		argIdx++
	}

	whereSQL := "WHERE " + strings.Join(whereClauses, " AND ")

	query := `
		SELECT id, product_id, user_name, product_name,
		       rating, comment, review_photo, COALESCE(approved, true) as approved, created_at
		FROM reviews
		` + whereSQL + `
		ORDER BY created_at DESC
		LIMIT $` + strconv.Itoa(argIdx) + ` OFFSET $` + strconv.Itoa(argIdx+1)

	args = append(args, limit, offset)

	rows, err := config.DB.Query(query, args...)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	reviews := make([]models.Review, 0)
	for rows.Next() {
		var r models.Review
		var pName, photo sql.NullString
		var app bool
		var cAt sql.NullTime

		err := rows.Scan(
			&r.ID, &r.ProductID, &r.UserName, &pName,
			&r.Rating, &r.Comment, &photo, &app, &cAt,
		)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}

		if pName.Valid {
			r.ProductName = &pName.String
		}
		if photo.Valid {
			r.ReviewPhoto = &photo.String
		}
		r.Approved = &app
		if cAt.Valid {
			r.CreatedAt = &cAt.Time
		}

		reviews = append(reviews, r)
	}

	return c.JSON(fiber.Map{"reviews": reviews})
}

// CreateReview creates a new customer review
func CreateReview(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	authHeader := c.Get("Authorization")
	user, err := middleware.ParseSupabaseToken(authHeader)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Authentication required"})
	}

	var req models.CreateReviewRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.OrderID == "" || req.ProductID == "" || req.Rating < 1 || strings.TrimSpace(req.Comment) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Missing required fields: orderId, productId, rating, comment"})
	}

	// Fetch reviewer's display name
	userName := "Pelanggan"
	if user.Email != "" {
		userName = user.Email
	}
	var profileName sql.NullString
	_ = config.DB.QueryRow("SELECT full_name FROM profiles WHERE id = $1 LIMIT 1", user.ID).Scan(&profileName)
	if profileName.Valid && profileName.String != "" {
		userName = profileName.String
	}

	query := `
		INSERT INTO reviews (
			user_id, order_id, product_id, product_name, user_name,
			rating, comment, review_photo, approved, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5,
			$6, $7, $8, true, NOW(), NOW()
		)
	`
	_, err = config.DB.Exec(
		query,
		user.ID, req.OrderID, req.ProductID, req.ProductName, userName,
		req.Rating, req.Comment, req.ReviewPhoto,
	)

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save review: " + err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"message": "Review created successfully",
	})
}

// UpdateReviewStatus approves or rejects a review (Supports single ID or Bulk IDs)
func UpdateReviewStatus(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	authHeader := c.Get("Authorization")
	user, err := middleware.ParseSupabaseToken(authHeader)
	if err != nil || (user.Role != "admin" && user.Role != "superadmin") {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Admin access required"})
	}

	var req models.UpdateReviewStatusRequest
	_ = c.BodyParser(&req)

	var targetIDs []string
	if len(req.ReviewIDs) > 0 {
		targetIDs = append(targetIDs, req.ReviewIDs...)
	}
	if len(req.IDs) > 0 {
		targetIDs = append(targetIDs, req.IDs...)
	}
	if req.ReviewID != "" {
		targetIDs = append(targetIDs, req.ReviewID)
	}
	if req.ID != "" {
		targetIDs = append(targetIDs, req.ID)
	}
	if qID := c.Query("id"); qID != "" {
		targetIDs = append(targetIDs, qID)
	}

	if len(targetIDs) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Missing reviewId or ids"})
	}

	// Build parameter placeholders
	placeholders := make([]string, len(targetIDs))
	args := make([]interface{}, len(targetIDs)+1)
	args[0] = req.Approved

	for i, id := range targetIDs {
		placeholders[i] = "$" + strconv.Itoa(i+2)
		args[i+1] = id
	}

	query := fmt.Sprintf("UPDATE reviews SET approved = $1, updated_at = NOW() WHERE id::text IN (%s)", strings.Join(placeholders, ", "))
	_, err = config.DB.Exec(query, args...)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": fmt.Sprintf("%d review status updated", len(targetIDs)),
	})
}

// DeleteReview deletes a review (Supports single ID or Bulk IDs)
func DeleteReview(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	authHeader := c.Get("Authorization")
	user, err := middleware.ParseSupabaseToken(authHeader)
	if err != nil || (user.Role != "admin" && user.Role != "superadmin") {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Admin access required"})
	}

	var req struct {
		ReviewID  string   `json:"reviewId"`
		ID        string   `json:"id"`
		ReviewIDs []string `json:"reviewIds"`
		IDs       []string `json:"ids"`
	}
	_ = c.BodyParser(&req)

	var targetIDs []string
	if len(req.ReviewIDs) > 0 {
		targetIDs = append(targetIDs, req.ReviewIDs...)
	}
	if len(req.IDs) > 0 {
		targetIDs = append(targetIDs, req.IDs...)
	}
	if req.ReviewID != "" {
		targetIDs = append(targetIDs, req.ReviewID)
	}
	if req.ID != "" {
		targetIDs = append(targetIDs, req.ID)
	}
	if qID := c.Query("id"); qID != "" {
		targetIDs = append(targetIDs, qID)
	}

	if len(targetIDs) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Missing reviewId or ids"})
	}

	placeholders := make([]string, len(targetIDs))
	args := make([]interface{}, len(targetIDs))
	for i, id := range targetIDs {
		placeholders[i] = "$" + strconv.Itoa(i+1)
		args[i] = id
	}

	query := fmt.Sprintf("DELETE FROM reviews WHERE id::text IN (%s)", strings.Join(placeholders, ", "))
	_, err = config.DB.Exec(query, args...)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": fmt.Sprintf("%d review(s) deleted", len(targetIDs)),
	})
}
