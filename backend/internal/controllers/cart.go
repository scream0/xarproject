package controllers

import (
	"database/sql"
	"encoding/json"
	"xar-backend-go/internal/config"
	"xar-backend-go/internal/middleware"
	"xar-backend-go/internal/models"

	"github.com/gofiber/fiber/v2"
)

// GetCart retrieves the shopping cart items for the authenticated user
func GetCart(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	authHeader := c.Get("Authorization")
	user, err := middleware.ParseSupabaseToken(authHeader)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var itemsRaw []byte
	err = config.DB.QueryRow("SELECT items FROM carts WHERE user_id = $1 LIMIT 1", user.ID).Scan(&itemsRaw)
	if err != nil {
		if err == sql.ErrNoRows {
			return c.JSON(fiber.Map{"items": []interface{}{}})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database error: " + err.Error()})
	}

	if len(itemsRaw) == 0 {
		return c.JSON(fiber.Map{"items": []interface{}{}})
	}

	var items interface{}
	if err := json.Unmarshal(itemsRaw, &items); err != nil {
		return c.JSON(fiber.Map{"items": []interface{}{}})
	}

	return c.JSON(fiber.Map{"items": items})
}

// UpdateCart saves or updates the shopping cart items
func UpdateCart(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	authHeader := c.Get("Authorization")
	user, err := middleware.ParseSupabaseToken(authHeader)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req models.UpdateCartRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if len(req.Items) == 0 {
		req.Items = []byte("[]")
	}

	query := `
		INSERT INTO carts (user_id, items)
		VALUES ($1, $2)
		ON CONFLICT (user_id) DO UPDATE SET items = EXCLUDED.items
	`
	_, err = config.DB.Exec(query, user.ID, req.Items)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save cart: " + err.Error()})
	}

	return c.JSON(fiber.Map{"message": "Cart updated successfully"})
}

// ClearCart empties the shopping cart for the user
func ClearCart(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	authHeader := c.Get("Authorization")
	user, err := middleware.ParseSupabaseToken(authHeader)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	_, err = config.DB.Exec("DELETE FROM carts WHERE user_id = $1", user.ID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "Cart cleared successfully"})
}
