package models

import "encoding/json"

type Cart struct {
	UserID string          `json:"userId"`
	Items  json.RawMessage `json:"items"`
}

type UpdateCartRequest struct {
	Items json.RawMessage `json:"items"`
}
