package models

import "time"

type Wallet struct {
	ID        string    `json:"id"`
	UserID    string    `json:"userId"`
	Balance   float64   `json:"balance"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type WalletTransaction struct {
	ID          string     `json:"id"`
	WalletID    string     `json:"walletId"`
	Amount      float64    `json:"amount"`
	Type        string     `json:"type"` // credit / debit
	Description string     `json:"description"`
	ReferenceID *string    `json:"referenceId,omitempty"`
	CreatedAt   *time.Time `json:"createdAt"`
}

type WithdrawRequest struct {
	Amount        float64 `json:"amount"`
	BankName      string  `json:"bankName"`
	AccountNumber string  `json:"accountNumber"`
	AccountHolder string  `json:"accountHolder"`
}
