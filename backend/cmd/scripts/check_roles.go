package main

import (
	"fmt"
	"log"

	"xar-backend-go/internal/config"

	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load("../../../.env.local")
	config.ConnectDB()
	if config.DB == nil {
		log.Fatal("Failed to connect to database")
	}
	defer config.DB.Close()

	query := `SELECT id, role FROM profiles LIMIT 10`
	rows, err := config.DB.Query(query)
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()

	fmt.Println("--- Profiles ---")
	for rows.Next() {
		var id, role string
		if err := rows.Scan(&id, &role); err != nil {
			log.Printf("Scan error: %v", err)
			continue
		}
		fmt.Printf("ID: %s | Role: '%s'\n", id, role)
	}
}
