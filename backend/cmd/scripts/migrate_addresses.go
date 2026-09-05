//go:build ignore

package main

import (
	"encoding/json"
	"fmt"
	"log"

	"xar-backend-go/internal/config"
	"github.com/joho/godotenv"
)

type OldAddress struct {
	ID             string `json:"id"`
	RecipientName  string `json:"recipient_name"`
	RecipientPhone string `json:"recipient_phone"`
	Label          string `json:"label"`
	Street         string `json:"street"`
	Province       string `json:"province"`
	City           string `json:"city"`
	CityID         string `json:"city_id"`
	PostalCode     string `json:"postal_code"`
	IsPrimary      bool   `json:"is_primary"`
}

func main() {
	_ = godotenv.Load("../../../.env.local")
	config.ConnectDB()
	if config.DB == nil {
		log.Fatal("Failed to connect to database")
	}
	defer config.DB.Close()

	// 1. Fetch old addresses
	query := `SELECT id, addresses FROM profiles WHERE addresses IS NOT NULL AND jsonb_array_length(addresses) > 0;`
	rows, err := config.DB.Query(query)
	if err != nil {
		log.Fatal("Failed to query profiles: ", err)
	}
	defer rows.Close()

	type Profile struct {
		ID        string
		Addresses string
	}

	var profiles []Profile
	for rows.Next() {
		var p Profile
		if err := rows.Scan(&p.ID, &p.Addresses); err != nil {
			log.Fatal("Failed to scan row: ", err)
		}
		profiles = append(profiles, p)
	}

	// 2. Iterate and Insert
	insertedCount := 0
	for _, p := range profiles {
		var oldAddrs []OldAddress
		if err := json.Unmarshal([]byte(p.Addresses), &oldAddrs); err != nil {
			log.Printf("Failed to unmarshal addresses for profile %s: %v", p.ID, err)
			continue
		}

		for _, addr := range oldAddrs {
			insertQuery := `
				INSERT INTO addresses (
					user_id, recipient_name, recipient_phone, street, city,
					city_id, province, postal_code, label, is_primary, created_at, updated_at
				) VALUES (
					$1, $2, $3, $4, $5,
					$6, $7, $8, $9, $10, NOW(), NOW()
				) ON CONFLICT DO NOTHING
			`
			_, err := config.DB.Exec(
				insertQuery,
				p.ID, addr.RecipientName, addr.RecipientPhone, addr.Street, addr.City,
				addr.CityID, addr.Province, addr.PostalCode, addr.Label, addr.IsPrimary,
			)
			if err != nil {
				log.Printf("Failed to insert address for profile %s: %v", p.ID, err)
			} else {
				insertedCount++
			}
		}
	}

	fmt.Printf("Migration completed! Successfully inserted %d old addresses.\n", insertedCount)
}
