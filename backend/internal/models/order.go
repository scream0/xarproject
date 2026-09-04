package models

import (
	"encoding/json"
	"time"
)

type OrderItem struct {
	ID               string   `json:"id"`
	OrderID          string   `json:"order_id"`
	ProductID        string   `json:"product_id"`
	ProductName      string   `json:"product_name"`
	VariantName      *string  `json:"variant_name,omitempty"`
	Price            float64  `json:"price"`
	PriceAtPurchase  float64  `json:"price_at_purchase"`
	Quantity         int      `json:"quantity"`
	Subtotal         float64  `json:"subtotal"`
	Size             *string  `json:"size,omitempty"`
	ImageURL         *string  `json:"image_url,omitempty"`
	WeightAtPurchase *float64 `json:"weight_at_purchase,omitempty"`
}

type Order struct {
	ID                   string          `json:"id"`
	OrderNumber          *string         `json:"order_number"`
	UserID               string          `json:"user_id"`
	CustomerName         *string         `json:"customer_name"`
	CustomerEmail        *string         `json:"customer_email"`
	CustomerPhone        *string         `json:"customer_phone"`
	Status               string          `json:"status"`
	TotalAmount          float64         `json:"total_amount"`
	ShippingCost         float64         `json:"shipping_cost"`
	DiscountAmount       float64         `json:"discount_amount"`
	GrossAmount          float64         `json:"gross_amount"`
	PaymentMethod        *string         `json:"payment_method"`
	PaymentType          *string         `json:"payment_type,omitempty"`
	SnapToken            *string         `json:"snap_token,omitempty"`
	ShippingAddress      json.RawMessage `json:"shipping_address"`
	ShippingDetail       json.RawMessage `json:"shipping_detail"`
	StatusHistory        json.RawMessage `json:"status_history"`
	TrackingHistory      json.RawMessage `json:"tracking_history"`
	WaybillID            *string         `json:"waybill_id,omitempty"`
	CourierName          *string         `json:"courier_name,omitempty"`
	CourierService       *string         `json:"courier_service,omitempty"`
	CourierTrackingLink  *string         `json:"courier_tracking_link,omitempty"`
	BiteshipOrderID      *string         `json:"biteship_order_id,omitempty"`
	Notes                *string         `json:"notes,omitempty"`
	Items                []OrderItem     `json:"items"`
	CreatedAt            *time.Time      `json:"created_at"`
	UpdatedAt            *time.Time      `json:"updated_at,omitempty"`
	ReturnStatus         string          `json:"return_status,omitempty"`
	ReturnAdminNote      string          `json:"return_admin_note,omitempty"`
}
