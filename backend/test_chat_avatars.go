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
		SELECT 
			c.user_id, 
			COALESCE(p.avatar_url, (au.raw_user_meta_data->>'avatar_url')::text, (au.raw_user_meta_data->>'picture')::text) as avatar_url
		FROM chats c
		LEFT JOIN profiles p ON c.user_id::text = p.id::text
		LEFT JOIN auth.users au ON c.user_id::text = au.id::text
		GROUP BY c.user_id, p.avatar_url, au.raw_user_meta_data
	`
	rows, err := config.DB.Query(query)
	if err != nil {
		fmt.Println("Error:", err)
		return
	}
	defer rows.Close()

	var list []map[string]interface{}
	for rows.Next() {
		var id string
		var avatar *string
		rows.Scan(&id, &avatar)
		list = append(list, map[string]interface{}{
			"id": id,
			"avatar": avatar,
		})
	}
	
	b, _ := json.MarshalIndent(list, "", "  ")
	fmt.Println(string(b))
}
