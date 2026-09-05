package models

import (
	"encoding/json"
	"time"
)

type Product struct {
	ID            string          `json:"id"`
	Name          string          `json:"name"`
	Description   *string         `json:"description"`
	Category      *string         `json:"category"`
	ImageURL      *string         `json:"image_url"`
	ImagePublicID *string         `json:"image_public_id,omitempty"`
	Variants      json.RawMessage `json:"variants"`
	Weight        *float64        `json:"weight,omitempty"`
	Length        *float64        `json:"length,omitempty"`
	Width         *float64        `json:"width,omitempty"`
	Height        *float64        `json:"height,omitempty"`
	Status        *string         `json:"status,omitempty"`
	Province      *string         `json:"province,omitempty"`
	City          *string         `json:"city,omitempty"`
	CityID        *string         `json:"cityId,omitempty"`
	StockLocation *string         `json:"stockLocation,omitempty"`
	CreatedAt     *time.Time      `json:"created_at"`
}
