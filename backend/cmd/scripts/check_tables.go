//go:build ignore

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
		log.Fatal("Failed to connect")
	}
	defer config.DB.Close()

	tables := []string{"order_items", "product_variants", "addresses"}
	for _, t := range tables {
		query := fmt.Sprintf("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '%s');", t)
		var exists bool
		err := config.DB.QueryRow(query).Scan(&exists)
		if err != nil {
			log.Fatal(err)
		}
		if exists {
			fmt.Printf("Table '%s' EXISTS.\n", t)
		} else {
			fmt.Printf("Table '%s' DOES NOT EXIST.\n", t)
		}
	}
}
