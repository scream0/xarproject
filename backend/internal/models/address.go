package models

import "time"

type Address struct {
	ID             string     `json:"id"`
	UserID         string     `json:"userId"`
	RecipientName  string     `json:"recipientName"`
	RecipientPhone string     `json:"recipientPhone"`
	Street         string     `json:"street"`
	City           string     `json:"city"`
	CityID         string     `json:"cityId"`
	Province       string     `json:"province"`
	PostalCode     string     `json:"postalCode"`
	Label          string     `json:"label"`
	IsPrimary      bool       `json:"isPrimary"`
	CreatedAt      *time.Time `json:"createdAt,omitempty"`
	UpdatedAt      *time.Time `json:"updatedAt,omitempty"`
}

type UpsertAddressRequest struct {
	RecipientName  string `json:"recipientName"`
	RecipientPhone string `json:"recipientPhone"`
	Street         string `json:"street"`
	City           string `json:"city"`
	CityID         string `json:"cityId"`
	Province       string `json:"province"`
	PostalCode     string `json:"postalCode"`
	Label          string `json:"label"`
	IsPrimary      bool   `json:"isPrimary"`
}
