//go:build ignore

package main

import (
	"encoding/json"
	"fmt"
	"xar-backend-go/internal/config"
	"github.com/joho/godotenv"
)

func main() {
	godotenv.Load("../.env.local")
	config.ConnectDB()

	rows, err := config.DB.Query(`
		SELECT column_name, data_type 
		FROM information_schema.columns 
		WHERE table_name = 'wallets'
	`)
	if err != nil {
		fmt.Println("Error:", err)
		return
	}
	defer rows.Close()

	list := make([]map[string]interface{}, 0)
	for rows.Next() {
		var col, dtype string
		rows.Scan(&col, &dtype)
		list = append(list, map[string]interface{}{
			"column": col,
			"type": dtype,
		})
	}
	b, _ := json.MarshalIndent(list, "", "  ")
	fmt.Println(string(b))
}
