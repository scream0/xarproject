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
		SELECT id, full_name, username, email FROM profiles WHERE id::text = '903e14d7-5a0c-4650-b4b7-ecb138540997'
	`
	row := config.DB.QueryRow(query)
	var id, fullName, username, email *string
	err := row.Scan(&id, &fullName, &username, &email)
	if err != nil {
		fmt.Println("Error:", err)
		return
	}
	
	res := map[string]interface{}{
		"id": id,
		"full_name": fullName,
		"username": username,
		"email": email,
	}
	
	b, _ := json.MarshalIndent(res, "", "  ")
	fmt.Println(string(b))
}
