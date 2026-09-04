package models

import "time"

// -- STORE SETTINGS (Landing Page) --
// This corresponds to the `hero`, `about`, `product`, `contact`, `footer` jsonb columns in `store_settings`

type HeroSection struct {
	Title       string `json:"title"`
	Subtitle    string `json:"subtitle"`
	ButtonText  string `json:"buttonText"`
	ButtonLink  string `json:"buttonLink"`
	ImageURL    string `json:"imageUrl"`
}

type AboutSection struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	ImageURL    string `json:"imageUrl"`
}

type ProductSection struct {
	Title       string `json:"title"`
	Description string `json:"description"`
}

type ContactSection struct {
	Email   string `json:"email"`
	Phone   string `json:"phone"`
	Address string `json:"address"`
}

type FooterSection struct {
	CopyrightText string `json:"copyrightText"`
	SocialLinks   map[string]string `json:"socialLinks"`
}

// -- PRODUCT --
// Corresponds to `variants` in `products`

type ProductVariant struct {
	Size  string  `json:"size"`
	Price float64 `json:"price"`
	Stock int     `json:"stock"`
}

// -- CART --
// Corresponds to `items` in `carts`

type CartItem struct {
	ProductID   string  `json:"productId"`
	VariantName string  `json:"variantName,omitempty"`
	Quantity    int     `json:"quantity"`
	Price       float64 `json:"price,omitempty"`
}

// -- ORDER --
// Corresponds to `shipping_address`, `shipping_detail`, `status_history` in `orders`

type OrderShippingAddress struct {
	RecipientName  string `json:"recipientName"`
	RecipientPhone string `json:"recipientPhone"`
	Street         string `json:"street"`
	City           string `json:"city"`
	CityID         string `json:"cityId"`
	Province       string `json:"province"`
	PostalCode     string `json:"postalCode"`
}

type OrderShippingDetail struct {
	CourierName    string  `json:"courierName"`
	CourierService string  `json:"courierService"`
	Cost           float64 `json:"cost"`
	EstimatedDays  string  `json:"estimatedDays,omitempty"`
}

type OrderStatusHistoryItem struct {
	Status    string    `json:"status"`
	Notes     string    `json:"notes,omitempty"`
	Timestamp time.Time `json:"timestamp"`
}
