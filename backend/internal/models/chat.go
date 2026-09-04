package models

import "time"

type Chat struct {
	ID        string     `json:"id"`
	UserID    string     `json:"user_id"`
	Message   string     `json:"message"`
	ImageURL   *string    `json:"image_url"`
	SenderRole string     `json:"sender_role"`
	IsRead     bool       `json:"is_read"`
	CreatedAt *time.Time `json:"created_at"`
}
