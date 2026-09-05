//go:build ignore

package main
import (
	"fmt"
	"log"
	"database/sql"
	"xar-backend-go/internal/config"
	"github.com/joho/godotenv"
)
func main() {
	godotenv.Load("../../../.env.local")
	config.ConnectDB()
	rows, err := config.DB.Query(`SELECT id, full_name, email, role, created_at FROM profiles`)
	if err != nil { log.Fatal("Query error:", err) }
	count := 0
	for rows.Next() {
		var id string
		var fName, email, role sql.NullString
		var cAt sql.NullTime
		if err := rows.Scan(&id, &fName, &email, &role, &cAt); err != nil {
			log.Println("Scan error:", err)
		}
		fmt.Printf("id: %s, email: %s, role: %s\n", id, email.String, role.String)
		count++
	}
	fmt.Println("Total:", count)
}
