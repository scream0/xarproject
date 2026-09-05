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

	rows, err := config.DB.Query("SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime'")
	if err != nil {
		fmt.Println("Error:", err)
		return
	}
	defer rows.Close()

	fmt.Println("Tables in supabase_realtime:")
	for rows.Next() {
		var name string
		rows.Scan(&name)
		fmt.Println("-", name)
	}
}
