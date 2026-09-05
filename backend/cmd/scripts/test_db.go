//go:build ignore

package main
import (
	"fmt"
	"xar-backend-go/internal/config"
	"github.com/joho/godotenv"
)
func main() {
	_ = godotenv.Load("../../../.env.local")
	config.ConnectDB()
	rows, _ := config.DB.Query("SELECT id, user_id, recipient_name, city_id FROM addresses")
	defer rows.Close()
	fmt.Println("Addresses in DB:")
	for rows.Next() {
		var id, uid, name, cid string
		rows.Scan(&id, &uid, &name, &cid)
		fmt.Printf("id: %s, uid: %s, name: %s, cid: %s\n", id, uid, name, cid)
	}
}
