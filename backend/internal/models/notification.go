package models

import "time"

type Notification struct {
	ID        string     `json:"id"`
	UserID    *string    `json:"user_id"`
	Title     string     `json:"title"`
	Message   string     `json:"message"`
	Type      *string    `json:"type"`
	Link      *string    `json:"link"`
	Audience  *string    `json:"audience"`
	IsRead    bool       `json:"is_read"`
	CreatedAt *time.Time `json:"created_at"`
}

type CreateNotificationRequest struct {
	UserID   *string `json:"userId"`
	Title    string  `json:"title"`
	Message  string  `json:"message"`
	Type     *string `json:"type"`
	Link     *string `json:"link"`
	Audience *string `json:"audience"`
}
