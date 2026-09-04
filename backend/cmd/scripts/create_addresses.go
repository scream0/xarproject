package main

import (
	"fmt"
	"log"
	"xar-backend-go/internal/config"

	"github.com/joho/godotenv"
)

func main() {
	err := godotenv.Load("../../../.env.local")
	if err != nil {
		fmt.Println("Warning: Could not load .env.local file, relying on environment variables.")
	}

	config.ConnectDB()
	if config.DB == nil {
		log.Fatal("Failed to connect to database")
	}
	defer config.DB.Close()

	query := `
	CREATE TABLE IF NOT EXISTS addresses (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		user_id UUID NOT NULL,
		recipient_name VARCHAR(255) NOT NULL,
		recipient_phone VARCHAR(50) NOT NULL,
		street TEXT NOT NULL,
		city VARCHAR(100) NOT NULL,
		city_id VARCHAR(50),
		province VARCHAR(100),
		postal_code VARCHAR(20),
		label VARCHAR(50) DEFAULT 'Rumah',
		is_primary BOOLEAN DEFAULT FALSE,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
		updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
	);
	`

	_, err = config.DB.Exec(query)
	if err != nil {
		log.Fatal("Failed to create table: ", err)
	}

	fmt.Println("Addresses table created successfully!")
}
