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

	query := `
		SELECT table_name, column_name, data_type 
		FROM information_schema.columns 
		WHERE table_schema = 'public' 
		AND data_type IN ('json', 'jsonb')
		ORDER BY table_name;
	`
	rows, err := config.DB.Query(query)
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()

	fmt.Println("--- JSON/JSONB Columns in Public Schema ---")
	for rows.Next() {
		var table, col, dtype string
		if err := rows.Scan(&table, &col, &dtype); err != nil {
			log.Fatal(err)
		}
		fmt.Printf("Table: %-20s Column: %-20s Type: %s\n", table, col, dtype)
	}

	// Specifically look at the "users" table columns
	query2 := `
		SELECT column_name, data_type 
		FROM information_schema.columns 
		WHERE table_schema = 'public' 
		AND table_name = 'users'
	`
	rows2, err := config.DB.Query(query2)
	if err == nil {
		fmt.Println("\n--- Columns in 'users' Table ---")
		for rows2.Next() {
			var col, dtype string
			rows2.Scan(&col, &dtype)
			fmt.Printf("Column: %-20s Type: %s\n", col, dtype)
		}
		rows2.Close()
	}

	// Also look at "profiles" table if exists
	query3 := `
		SELECT column_name, data_type 
		FROM information_schema.columns 
		WHERE table_schema = 'public' 
		AND table_name = 'profiles'
	`
	rows3, err := config.DB.Query(query3)
	if err == nil {
		fmt.Println("\n--- Columns in 'profiles' Table ---")
		for rows3.Next() {
			var col, dtype string
			rows3.Scan(&col, &dtype)
			fmt.Printf("Column: %-20s Type: %s\n", col, dtype)
		}
		rows3.Close()
	}
}
