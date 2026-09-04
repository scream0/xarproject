package controllers

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"strings"
	"sync"
	"time"

	"xar-backend-go/internal/whatsapp"

	"github.com/gofiber/fiber/v2"
)

var (
	otpStoreLock sync.RWMutex
	otpStore     = make(map[string]otpEntry)
)

type otpEntry struct {
	Code      string
	ExpiresAt time.Time
}

// Login handles user authentication session setup
func Login(c *fiber.Ctx) error {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	_ = c.BodyParser(&req)

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Login route mapped to Go backend",
	})
}

// Logout invalidates session
func Logout(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"success": true,
		"message": "Logged out successfully",
	})
}

// SendWhatsAppOTP generates and sends OTP via WhatsApp
func SendWhatsAppOTP(c *fiber.Ctx) error {
	var req struct {
		Phone string `json:"phone"`
	}
	if err := c.BodyParser(&req); err != nil || strings.TrimSpace(req.Phone) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Phone number is required"})
	}

	phone := strings.TrimSpace(req.Phone)

	// Generate 6 digit numeric code
	n, _ := rand.Int(rand.Reader, big.NewInt(900000))
	code := fmt.Sprintf("%06d", n.Int64()+100000)

	otpStoreLock.Lock()
	otpStore[phone] = otpEntry{
		Code:      code,
		ExpiresAt: time.Now().Add(5 * time.Minute),
	}
	otpStoreLock.Unlock()

	// Send message via whatsmeow
	msg := fmt.Sprintf("*VERIFIKASI MAKE ME KOOL*\n\nKode OTP Anda adalah: *%s*\nBerlaku selama 5 menit. Jangan berikan kode ini kepada siapapun.", code)
	err := whatsapp.SendMessage(phone, msg)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error": "Failed to send WhatsApp message: " + err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "OTP sent successfully to " + phone,
	})
}

// VerifyWhatsAppOTP validates the OTP code
func VerifyWhatsAppOTP(c *fiber.Ctx) error {
	var req struct {
		Phone string `json:"phone"`
		Code  string `json:"code"`
	}
	if err := c.BodyParser(&req); err != nil || req.Phone == "" || req.Code == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Phone and Code are required"})
	}

	otpStoreLock.RLock()
	entry, exists := otpStore[req.Phone]
	otpStoreLock.RUnlock()

	if !exists || time.Now().After(entry.ExpiresAt) || entry.Code != req.Code {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid or expired OTP code"})
	}

	otpStoreLock.Lock()
	delete(otpStore, req.Phone)
	otpStoreLock.Unlock()

	return c.JSON(fiber.Map{
		"success": true,
		"message": "OTP verified successfully",
	})
}
