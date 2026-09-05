package services

import (
	"bytes"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"strings"
	"time"
	"xar-backend-go/internal/config"
)

type SnapAddress struct {
	FirstName   string `json:"first_name,omitempty"`
	Phone       string `json:"phone,omitempty"`
	Address     string `json:"address,omitempty"`
	City        string `json:"city,omitempty"`
	PostalCode  string `json:"postal_code,omitempty"`
	CountryCode string `json:"country_code,omitempty"`
}

type SnapCustomerDetails struct {
	FirstName       string       `json:"first_name,omitempty"`
	Email           string       `json:"email,omitempty"`
	Phone           string       `json:"phone,omitempty"`
	BillingAddress  *SnapAddress `json:"billing_address,omitempty"`
	ShippingAddress *SnapAddress `json:"shipping_address,omitempty"`
}

type SnapCallbacks struct {
	Finish   string `json:"finish,omitempty"`
	Unfinish string `json:"unfinish,omitempty"`
	Error    string `json:"error,omitempty"`
}

type SnapRequest struct {
	TransactionDetails struct {
		OrderID     string `json:"order_id"`
		GrossAmount int64  `json:"gross_amount"`
	} `json:"transaction_details"`
	CustomerDetails SnapCustomerDetails `json:"customer_details"`
	ItemDetails     []SnapItem          `json:"item_details,omitempty"`
	Callbacks       *SnapCallbacks      `json:"callbacks,omitempty"`
}

type SnapItem struct {
	ID       string `json:"id"`
	Price    int64  `json:"price"`
	Quantity int    `json:"quantity"`
	Name     string `json:"name"`
}

type SnapResponse struct {
	Token         string   `json:"token"`
	RedirectURL   string   `json:"redirect_url"`
	ErrorMessages []string `json:"error_messages,omitempty"`
}

func getMidtransServerKey() (string, bool) {
	isProduction := false
	if config.DB != nil {
		var isProd sql.NullBool
		_ = config.DB.QueryRow("SELECT midtrans_is_production FROM store_config WHERE id = 'main' LIMIT 1").Scan(&isProd)
		if isProd.Valid {
			isProduction = isProd.Bool
		}
	}

	if isProduction {
		return os.Getenv("MIDTRANS_SERVER_KEY_PRODUCTION"), true
	}
	return os.Getenv("MIDTRANS_SERVER_KEY_SANDBOX"), false
}

// CreateSnapToken sends transaction parameters to Midtrans and returns the snap token
func CreateSnapToken(orderID string, grossAmount float64, custDetails SnapCustomerDetails, items []SnapItem) (string, error) {
	serverKey, isProd := getMidtransServerKey()
	if serverKey == "" {
		return "", fmt.Errorf("midtrans server key is not configured")
	}

	apiURL := "https://app.sandbox.midtrans.com/snap/v1/transactions"
	if isProd {
		apiURL = "https://app.midtrans.com/snap/v1/transactions"
	}

	frontendURL := os.Getenv("NEXT_PUBLIC_APP_URL")
	if frontendURL == "" {
		frontendURL = os.Getenv("FRONTEND_URL")
	}
	if frontendURL == "" {
		frontendURL = "https://mameko.my.id"
	}
	frontendURL = strings.TrimRight(frontendURL, "/")

	intGross := int64(math.Round(grossAmount))
	if intGross <= 0 {
		intGross = 1
	}

	snapReq := SnapRequest{}
	snapReq.TransactionDetails.OrderID = orderID
	snapReq.TransactionDetails.GrossAmount = intGross
	snapReq.CustomerDetails = custDetails

	var itemSum int64
	for _, it := range items {
		itemSum += it.Price * int64(it.Quantity)
	}
	if len(items) > 0 && itemSum == intGross {
		snapReq.ItemDetails = items
	} else {
		snapReq.ItemDetails = nil
	}
	snapReq.Callbacks = &SnapCallbacks{
		Finish:   fmt.Sprintf("%s/dashboard/order-detail?id=%s", frontendURL, orderID),
		Unfinish: fmt.Sprintf("%s/dashboard/order-detail?id=%s", frontendURL, orderID),
		Error:    fmt.Sprintf("%s/dashboard/order-detail?id=%s", frontendURL, orderID),
	}

	reqBytes, err := json.Marshal(snapReq)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequest("POST", apiURL, bytes.NewBuffer(reqBytes))
	if err != nil {
		return "", err
	}

	authHeader := "Basic " + base64.StdEncoding.EncodeToString([]byte(serverKey+":"))
	req.Header.Set("Authorization", authHeader)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 12 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var snapResp SnapResponse
	if err := json.Unmarshal(respBytes, &snapResp); err != nil {
		return "", err
	}

	if snapResp.Token == "" {
		return "", fmt.Errorf("failed to generate snap token: %s", string(respBytes))
	}

	return snapResp.Token, nil
}

// CheckMidtransStatus queries Midtrans GET /v2/{order_id}/status
func CheckMidtransStatus(orderID string) (map[string]interface{}, error) {
	serverKey, isProd := getMidtransServerKey()
	if serverKey == "" {
		return nil, fmt.Errorf("midtrans server key is not configured")
	}

	baseURL := "https://api.sandbox.midtrans.com/v2"
	if isProd {
		baseURL = "https://api.midtrans.com/v2"
	}

	apiURL := fmt.Sprintf("%s/%s/status", baseURL, orderID)
	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		return nil, err
	}

	authHeader := "Basic " + base64.StdEncoding.EncodeToString([]byte(serverKey+":"))
	req.Header.Set("Authorization", authHeader)
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var statusResp map[string]interface{}
	if err := json.Unmarshal(respBytes, &statusResp); err != nil {
		return nil, err
	}

	return statusResp, nil
}
