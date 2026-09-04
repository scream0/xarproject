package config

import (
	"database/sql"
	"fmt"
	"log"
	"net/url"
	"os"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/stdlib"
)

var DB *sql.DB

// ConnectDB establishes a connection to the PostgreSQL database using raw SQL (pgx driver).
func ConnectDB() {
	rawDsn := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if rawDsn == "" {
		log.Println("DATABASE_URL is not set in the environment variables")
		return
	}

	cleanDsn := strings.ReplaceAll(rawDsn, "[", "")
	cleanDsn = strings.ReplaceAll(cleanDsn, "]", "")

	var dsnCandidates []string

	u, err := url.Parse(cleanDsn)
	if err == nil {
		host := u.Hostname()
		if strings.HasPrefix(host, "db.") && strings.HasSuffix(host, ".supabase.co") {
			parts := strings.Split(host, ".")
			if len(parts) == 4 {
				ref := parts[1]
				pass, _ := u.User.Password()
				dbName := strings.TrimPrefix(u.Path, "/")
				if dbName == "" {
					dbName = "postgres"
				}

				// Pooler AWS AP-Southeast-1 (Singapore)
				p1 := fmt.Sprintf("postgres://postgres.%s:%s@aws-0-ap-southeast-1.pooler.supabase.com:6543/%s?sslmode=require", ref, url.QueryEscape(pass), dbName)
				p2 := fmt.Sprintf("postgres://postgres.%s:%s@aws-0-ap-southeast-1.pooler.supabase.com:5432/%s?sslmode=require", ref, url.QueryEscape(pass), dbName)
				// Pooler AWS US-East-1
				p3 := fmt.Sprintf("postgres://postgres.%s:%s@aws-0-us-east-1.pooler.supabase.com:6543/%s?sslmode=require", ref, url.QueryEscape(pass), dbName)

				dsnCandidates = append(dsnCandidates, p1, p2, p3)
			}
		}
	}

	dsnCandidates = append(dsnCandidates, cleanDsn)

	var activeDB *sql.DB

	for _, dsn := range dsnCandidates {
		// Mask password for log
		masked := dsn
		if parsed, err := url.Parse(dsn); err == nil {
			masked = parsed.Redacted()
		}
		log.Printf("Mencoba koneksi ke: %s ...\n", masked)

		connConfig, err := pgx.ParseConfig(dsn)
		if err != nil {
			log.Printf("Gagal parse config: %v\n", err)
			continue
		}

		// Disable prepared statement cache for PgBouncer / Supabase pooler compatibility
		connConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol

		db := stdlib.OpenDB(*connConfig)

		if err = db.Ping(); err != nil {
			db.Close()
			log.Printf("Gagal ping: %v\n", err)
			continue
		}

		log.Printf("✅ Terhubung ke: %s\n", masked)
		activeDB = db
		break
	}

	if activeDB == nil {
		log.Println("⚠️ Semua percobaan koneksi ke Database gagal.")
		return
	}

	log.Println("✅ Berhasil terhubung ke PostgreSQL Supabase via Raw SQL!")
	DB = activeDB

	// Ensure withdrawals table exists
	_, err = DB.Exec(`
		CREATE TABLE IF NOT EXISTS withdrawals (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
			amount NUMERIC(15,2) NOT NULL,
			bank_name VARCHAR(100) NOT NULL,
			account_number VARCHAR(100) NOT NULL,
			account_holder VARCHAR(150) NOT NULL,
			status VARCHAR(50) DEFAULT 'pending',
			reference_type VARCHAR(50),
			reference_id VARCHAR(255),
			created_at TIMESTAMPTZ DEFAULT NOW(),
			updated_at TIMESTAMPTZ DEFAULT NOW()
		);
		CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id);
		CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
	`)
	if err != nil {
		log.Printf("⚠️ Gagal membuat tabel withdrawals: %v\n", err)
	}
}
