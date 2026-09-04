package models

import "time"

type Review struct {
	ID          string     `json:"id"`
	UserID      *string    `json:"userId,omitempty"`
	OrderID     *string    `json:"orderId,omitempty"`
	ProductID   string     `json:"productId"`
	UserName    string     `json:"userName"`
	ProductName *string    `json:"productName,omitempty"`
	Rating      int        `json:"rating"`
	Comment     string     `json:"comment"`
	ReviewPhoto *string    `json:"reviewPhoto,omitempty"`
	Approved    *bool      `json:"approved"`
	CreatedAt   *time.Time `json:"createdAt"`
	UpdatedAt   *time.Time `json:"updatedAt,omitempty"`
}

type CreateReviewRequest struct {
	UserID      string  `json:"userId"`
	OrderID     string  `json:"orderId"`
	ProductID   string  `json:"productId"`
	ProductName string  `json:"productName"`
	Rating      int     `json:"rating"`
	Comment     string  `json:"comment"`
	ReviewPhoto *string `json:"reviewPhoto"`
}

type UpdateReviewStatusRequest struct {
	ReviewID  string   `json:"reviewId"`
	ID        string   `json:"id"`
	ReviewIDs []string `json:"reviewIds"`
	IDs       []string `json:"ids"`
	Approved  bool     `json:"approved"`
}
