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
		SELECT id, email, raw_user_meta_data FROM auth.users LIMIT 5
	`
	rows, err := config.DB.Query(query)
	if err != nil {
		fmt.Println("Error:", err)
		return
	}
	defer rows.Close()

	var users []map[string]interface{}
	for rows.Next() {
		var id string
		var email *string
		var meta *string
		rows.Scan(&id, &email, &meta)
		users = append(users, map[string]interface{}{
			"id": id,
			"email": email,
			"meta": meta,
		})
	}
	
	b, _ := json.MarshalIndent(users, "", "  ")
	fmt.Println(string(b))
}
