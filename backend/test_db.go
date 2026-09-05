//go:build ignore

package main

import (
	"fmt"
	"xar-backend-go/internal/config"
)

func main() {
	config.InitDB()
	var email string
	err := config.DB.QueryRow("SELECT email FROM profiles LIMIT 1").Scan(&email)
	if err != nil {
		fmt.Println("EMAIL ERROR:", err)
	}
	var role string
	err = config.DB.QueryRow("SELECT role FROM profiles LIMIT 1").Scan(&role)
	if err != nil {
		fmt.Println("ROLE ERROR:", err)
	}
}
