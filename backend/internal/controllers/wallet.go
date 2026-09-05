package controllers

import (
	"database/sql"
	"xar-backend-go/internal/config"
	"xar-backend-go/internal/middleware"
	"xar-backend-go/internal/models"

	"github.com/gofiber/fiber/v2"
)

// GetWallet returns current user's wallet balance and transactions
func GetWallet(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	authHeader := c.Get("Authorization")
	user, err := middleware.ParseSupabaseToken(authHeader)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var balance float64
	err = config.DB.QueryRow("SELECT balance FROM wallets WHERE user_id = $1 LIMIT 1", user.ID).Scan(&balance)
	if err != nil {
		if err == sql.ErrNoRows {
			// Auto create wallet
			balance = 0
			_, _ = config.DB.Exec("INSERT INTO wallets (user_id, balance, created_at, updated_at) VALUES ($1, 0, NOW(), NOW()) ON CONFLICT (user_id) DO NOTHING", user.ID)
		} else {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}
	}

	// Fetch transactions
	txRows, err := config.DB.Query(
		"SELECT id, wallet_id, amount, type, description, reference_id, created_at FROM wallet_transactions WHERE wallet_id = $1 ORDER BY created_at DESC LIMIT 50",
		user.ID,
	)

	transactions := make([]models.WalletTransaction, 0)
	if err == nil {
		defer txRows.Close()
		for txRows.Next() {
			var tx models.WalletTransaction
			var refID sql.NullString
			var cAt sql.NullTime

			if err := txRows.Scan(&tx.ID, &tx.WalletID, &tx.Amount, &tx.Type, &tx.Description, &refID, &cAt); err == nil {
				if refID.Valid {
					tx.ReferenceID = &refID.String
				}
				if cAt.Valid {
					tx.CreatedAt = &cAt.Time
				}
				transactions = append(transactions, tx)
			}
		}
		if err := txRows.Err(); err != nil {
			_ = err // ignored or handle appropriately
		}
	}

	return c.JSON(fiber.Map{
		"success":      true,
		"balance":      balance,
		"transactions": transactions,
	})
}

// RequestWithdrawal creates a new withdrawal request
func RequestWithdrawal(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	authHeader := c.Get("Authorization")
	user, err := middleware.ParseSupabaseToken(authHeader)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req models.WithdrawRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.Amount <= 0 || req.BankName == "" || req.AccountNumber == "" || req.AccountHolder == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Missing required withdrawal fields"})
	}

	// Check balance
	var balance float64
	err = config.DB.QueryRow("SELECT balance FROM wallets WHERE user_id = $1 LIMIT 1", user.ID).Scan(&balance)
	if err != nil || balance < req.Amount {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Saldo dompet tidak mencukupi."})
	}

	query := `
		INSERT INTO withdrawals (
			user_id, amount, bank_name, account_number, account_holder, status, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, 'pending', NOW(), NOW()
		)
	`
	_, err = config.DB.Exec(query, user.ID, req.Amount, req.BankName, req.AccountNumber, req.AccountHolder)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to submit withdrawal: " + err.Error()})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Permintaan penarikan berhasil diajukan.",
	})
}
