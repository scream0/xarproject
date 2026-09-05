//go:build ignore

package main

import (
	"database/sql"
	"fmt"
	"os"
	_ "github.com/jackc/pgx/v5/stdlib"
)

func main() {
	dbURL := "postgres://postgres.gwdvcfuzwchnfrhnhaek:qBrUiPcKIFMqAop1@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require"
	db, err := sql.Open("pgx", dbURL)
	if err != nil {
		fmt.Printf("Error connecting: %v\n", err)
		os.Exit(1)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		fmt.Printf("Error pinging: %v\n", err)
		os.Exit(1)
	}

	query := `
		ALTER TABLE return_requests ADD COLUMN IF NOT EXISTS evidence_url TEXT;
		ALTER TABLE return_requests ADD COLUMN IF NOT EXISTS admin_note TEXT;
	`
	_, err = db.Exec(query)
	if err != nil {
		fmt.Printf("Migration error: %v\n", err)
	} else {
		fmt.Println("Migration successful: added evidence_url and admin_note to return_requests")
	}
}
