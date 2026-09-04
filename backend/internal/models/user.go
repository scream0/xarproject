package models

import "time"

type UserProfile struct {
	ID           string                   `json:"id"`
	FullName     *string                  `json:"full_name"`
	Email        *string                  `json:"email"`
	Phone        *string                  `json:"phone,omitempty"`
	Role         string                   `json:"role"`
	AvatarURL    *string                  `json:"avatar_url,omitempty"`
	UserMetadata map[string]interface{}   `json:"user_metadata,omitempty"`
	UserVouchers []map[string]interface{} `json:"user_vouchers,omitempty"`
	CreatedAt    *time.Time               `json:"created_at,omitempty"`
	UpdatedAt    *time.Time               `json:"updated_at,omitempty"`
}

type UpdateUserRequest struct {
	Username             *string `json:"username"`
	FullName             *string `json:"full_name"`
	Phone                *string `json:"phone"`
	Gender               *string `json:"gender"`
	BirthDate            *string `json:"birth_date"`
	PhotoURL             *string `json:"photo_url"`
	PhotoPublicID        *string `json:"photo_public_id"`
	NewsletterSubscribed *bool   `json:"newsletter_subscribed"`
	BankName             *string `json:"bank_name"`
	BankAccountNumber    *string `json:"bank_account_number"`
	BankAccountName      *string `json:"bank_account_name"`
	AvatarURL            *string `json:"avatarUrl"` // for backward compatibility
}
