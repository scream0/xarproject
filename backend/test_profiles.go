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
		SELECT id, avatar_url, full_name FROM profiles
	`
	rows, err := config.DB.Query(query)
	if err != nil {
		fmt.Println("Error:", err)
		return
	}
	defer rows.Close()

	var profiles []map[string]interface{}
	for rows.Next() {
		var id string
		var avatar *string
		var name *string
		rows.Scan(&id, &avatar, &name)
		profiles = append(profiles, map[string]interface{}{
			"id": id,
			"avatar": avatar,
			"name": name,
		})
	}
	
	b, _ := json.MarshalIndent(profiles, "", "  ")
	fmt.Println(string(b))
}
