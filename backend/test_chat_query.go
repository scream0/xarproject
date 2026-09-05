//go:build ignore

package main

import (
	"fmt"
	"log"
	"path/filepath"
	"runtime"
	"xar-backend-go/internal/config"
	"github.com/joho/godotenv"
)

func main() {
	_, thisFile, _, _ := runtime.Caller(0)
	projectRoot := filepath.Join(filepath.Dir(thisFile), "..")
	envPath := filepath.Join(projectRoot, ".env.local")
	if err := godotenv.Load(envPath); err == nil {
		log.Printf("Loaded env from %s", envPath)
	} else {
		log.Printf("Failed to load env from %s: %v", envPath, err)
	}

	config.ConnectDB()
	if config.DB == nil {
		log.Fatal("Failed to connect to db")
	}
	defer config.DB.Close()

	query := `
		SELECT 
			c.user_id, 
			MAX(c.created_at) as last_activity, 
			COUNT(CASE WHEN c.is_read = false AND c.sender_role = 'user' THEN 1 END) as unread_count,
			COALESCE(p.full_name, (au.raw_user_meta_data->>'full_name')::text, (au.raw_user_meta_data->>'name')::text, au.email) as full_name,
			COALESCE(p.avatar_url, (au.raw_user_meta_data->>'avatar_url')::text, (au.raw_user_meta_data->>'picture')::text) as avatar_url,
			au.email,
			(SELECT message FROM chats WHERE user_id = c.user_id ORDER BY created_at DESC LIMIT 1) as last_message,
			(SELECT image_url FROM chats WHERE user_id = c.user_id ORDER BY created_at DESC LIMIT 1) as last_image
		FROM chats c
		LEFT JOIN profiles p ON c.user_id::text = p.id::text
		LEFT JOIN auth.users au ON c.user_id::text = au.id::text
		GROUP BY c.user_id, p.full_name, p.avatar_url, au.raw_user_meta_data, au.email
		ORDER BY last_activity DESC
	`
	rows, err := config.DB.Query(query)
	if err != nil {
		log.Fatalf("Query failed: %v", err)
	}
	defer rows.Close()
	
	for rows.Next() {
		var userID string
		var lastActivity string
		var unreadCount int
		var fullName *string
		var avatarURL *string
		var email *string
		var lastMessage *string
		var lastImage *string
		if err := rows.Scan(&userID, &lastActivity, &unreadCount, &fullName, &avatarURL, &email, &lastMessage, &lastImage); err != nil {
			fmt.Printf("Scan error: %v\n", err)
			continue
		}
		fmt.Printf("- %s: last=%s email=%v\n", userID, lastActivity, email)
	}
}
