package controllers

import "github.com/gofiber/fiber/v2"

// HealthCheck responds with a 200 OK status to indicate the server is running.
func HealthCheck(c *fiber.Ctx) error {
	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"status":  "success",
		"message": "MAMEKO Backend is running smoothly",
	})
}
