package main
import (
	"fmt"
	"xar-backend-go/internal/config"
	"github.com/joho/godotenv"
)
func main() {
	_ = godotenv.Load("../../../.env.local")
	config.ConnectDB()
	var exists bool
	_ = config.DB.QueryRow("SELECT EXISTS(SELECT 1 FROM profiles WHERE id = '903e14d7-5a0c-4650-b4b7-ecb138540997')").Scan(&exists)
	fmt.Printf("Profile exists: %v\n", exists)
}
