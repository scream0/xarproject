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
			MAX(c.created_at) as last_activity, 
			COUNT(CASE WHEN c.is_read = false AND c.sender_role = 'user' THEN 1 END) as unread_count,
			COALESCE(p.full_name, (au.raw_user_meta_data->>'full_name')::text, (au.raw_user_meta_data->>'name')::text) as full_name,
			COALESCE(p.avatar_url, (au.raw_user_meta_data->>'avatar_url')::text, (au.raw_user_meta_data->>'picture')::text) as avatar_url,
			(SELECT message FROM chats WHERE user_id = c.user_id ORDER BY created_at DESC LIMIT 1) as last_message,
			(SELECT image_url FROM chats WHERE user_id = c.user_id ORDER BY created_at DESC LIMIT 1) as last_image
		FROM chats c
		LEFT JOIN profiles p ON c.user_id::text = p.id::text
		LEFT JOIN auth.users au ON c.user_id::text = au.id::text
		GROUP BY c.user_id, p.full_name, p.avatar_url, au.raw_user_meta_data
		ORDER BY last_activity DESC
	`
	rows, err := config.DB.Query(query)
	if err != nil {
		fmt.Println("Error:", err)
		return
	}
	defer rows.Close()

	var list []map[string]interface{}
	for rows.Next() {
		var userID string
		var lastActivity string
		var unreadCount int
		var fullName *string
		var avatarURL *string
		var lastMessage *string
		var lastImage *string
		if err := rows.Scan(&userID, &lastActivity, &unreadCount, &fullName, &avatarURL, &lastMessage, &lastImage); err != nil {
			fmt.Println("Scan Error:", err)
			continue
		}
		list = append(list, map[string]interface{}{
			"user_id":       userID,
			"last_activity": lastActivity,
			"unread_count":  unreadCount,
			"full_name":     fullName,
			"avatar_url":    avatarURL,
			"last_message":  lastMessage,
			"last_image":    lastImage,
		})
	}
	b, _ := json.MarshalIndent(list, "", "  ")
	fmt.Println(string(b))
}
