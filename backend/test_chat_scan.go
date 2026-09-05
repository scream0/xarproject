//go:build ignore

package main

import (
	"fmt"
	"log"
	"path/filepath"
	"runtime"
	"xar-backend-go/internal/config"
	"xar-backend-go/internal/models"
	"github.com/joho/godotenv"
)

func main() {
	_, thisFile, _, _ := runtime.Caller(0)
	projectRoot := filepath.Join(filepath.Dir(thisFile), "..")
	envPath := filepath.Join(projectRoot, ".env.local")
	godotenv.Load(envPath)
	
	config.ConnectDB()
	if config.DB == nil {
		log.Fatal("Failed to connect to db")
	}
	defer config.DB.Close()

	query := `
		SELECT id, user_id, message, image_url, sender_role, is_read, created_at
		FROM chats
		ORDER BY created_at ASC
	`
	rows, err := config.DB.Query(query)
	if err != nil {
		log.Fatalf("Query failed: %v", err)
	}
	defer rows.Close()
	
	for rows.Next() {
		var chat models.Chat
		if err := rows.Scan(&chat.ID, &chat.UserID, &chat.Message, &chat.ImageURL, &chat.SenderRole, &chat.IsRead, &chat.CreatedAt); err != nil {
			fmt.Printf("Scan error: %v\n", err)
			continue
		}
		fmt.Printf("Scanned chat: %+v\n", chat)
	}
}
