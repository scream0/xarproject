//go:build ignore

package main

import (
	"fmt"
	"xar-backend-go/internal/config"
	"github.com/joho/godotenv"
)

func main() {
	godotenv.Load("../.env.local")
	godotenv.Load(".env")

	config.ConnectDB()

	var storeName, storeCity, areaID string
	err := config.DB.QueryRow("SELECT store_name, store_city_name, biteship_area_id FROM store_config WHERE id = 'main'").Scan(&storeName, &storeCity, &areaID)
	if err != nil {
		fmt.Println("Error:", err)
		return
	}
	fmt.Printf("Store Name: %s\nCity: %s\nArea ID: %s\n", storeName, storeCity, areaID)
}
