package models

import "time"

type Voucher struct {
	ID             string     `json:"id"`
	Code           string     `json:"code"`
	Title          string     `json:"title"`
	Type           string     `json:"type"` // percentage, fixed, shipping
	DiscountAmount float64    `json:"discount_amount"`
	MinPurchase    float64    `json:"min_purchase"`
	ValidUntil     *time.Time `json:"valid_until,omitempty"`
	UsageLimit     int        `json:"usage_limit"`
	UsedCount      int        `json:"used_count"`
	IsActive       bool       `json:"is_active"`
	CreatedAt      *time.Time `json:"created_at,omitempty"`
}
