package main
import ("log"; "xar-backend-go/internal/config"; "github.com/joho/godotenv")
func main() {
    godotenv.Load("../../../.env.local")
    config.ConnectDB()
    _, err := config.DB.Exec(`ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()`)
    if err != nil { log.Println("created_at error:", err) }
    _, err = config.DB.Exec(`ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS used_count INT DEFAULT 0`)
    if err != nil { log.Println("used_count error:", err) }
    log.Println("Database migration completed.")
}
