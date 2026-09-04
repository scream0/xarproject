package models

import "encoding/json"

type StoreSettings struct {
	StoreName            string          `json:"storeName"`
	StoreEmail           string          `json:"storeEmail"`
	Currency             string          `json:"currency"`
	AdminLocale          string          `json:"adminLocale"`
	LowStockThreshold    int             `json:"lowStockThreshold"`
	StoreCityID          string          `json:"storeCityId"`
	StoreCityName        string          `json:"storeCityName"`
	EnableMidtrans       bool            `json:"enableMidtrans"`
	EnableManualTransfer bool            `json:"enableManualTransfer"`
	MidtransIsProduction bool            `json:"midtransIsProduction"`
	BiteshipIsProduction bool            `json:"biteshipIsProduction"`
	BiteshipAutoOrder    bool            `json:"biteshipAutoOrder"`
	Hero                 json.RawMessage `json:"hero"`
	About                json.RawMessage `json:"about"`
	Product              json.RawMessage `json:"product"`
	Contact              json.RawMessage `json:"contact"`
	Footer               json.RawMessage `json:"footer"`
	PromoBannerEnabled   bool            `json:"promoBannerEnabled"`
	PromoBannerText      string          `json:"promoBannerText"`
	PromoDiscountType    string          `json:"promoDiscountType"`
	PromoDiscountValue   float64         `json:"promoDiscountValue"`
	PromoStartDate       string          `json:"promoStartDate"`
	PromoEndDate         string          `json:"promoEndDate"`
	PromoCode            string          `json:"promoCode"`
	PromoDestination     string          `json:"promoDestination"`
	ActiveCouriers       json.RawMessage `json:"activeCouriers"`
}
