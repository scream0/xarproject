//go:build ignore

package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/gofiber/fiber/v2"
	"github.com/joho/godotenv"

	"xar-backend-go/internal/config"
	"xar-backend-go/internal/controllers"
)

func main() {
	godotenv.Load("../.env.local")
	godotenv.Load(".env")

	config.ConnectDB()

	app := fiber.New()
	app.Post("/test", controllers.CreateBiteshipOrder)

	body := []byte(`{"orderId": "244272e2-d162-450c-8d6e-d09f8f979386"}`)
	req, _ := http.NewRequest("POST", "/test", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req, -1)
	if err != nil {
		fmt.Println("Test error:", err)
		return
	}

	respBody, _ := io.ReadAll(resp.Body)
	fmt.Println("Status Code:", resp.StatusCode)
	fmt.Println("Response Body:")
	
	// Pretty print JSON
	var prettyJSON bytes.Buffer
	if err := json.Indent(&prettyJSON, respBody, "", "  "); err == nil {
		fmt.Println(prettyJSON.String())
	} else {
		fmt.Println(string(respBody))
	}
}
