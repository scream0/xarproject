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

	query := `
		SELECT raw_user_meta_data, email FROM auth.users WHERE id = '903e14d7-5a0c-4650-b4b7-ecb138540997'
	`
	row := config.DB.QueryRow(query)
	var rawMetaData *string
	var email *string
	err := row.Scan(&rawMetaData, &email)
	if err != nil {
		fmt.Println("Error:", err)
		return
	}
	
	res := map[string]interface{}{
		"email": email,
		"raw_meta": rawMetaData,
	}
	
	b, _ := json.MarshalIndent(res, "", "  ")
	fmt.Println(string(b))
}
