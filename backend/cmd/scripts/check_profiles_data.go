//go:build ignore

package main
import ("fmt"; "log"; "xar-backend-go/internal/config"; "github.com/joho/godotenv"; "database/sql")
func main() {
    godotenv.Load("../../../.env.local")
    config.ConnectDB()
    rows, err := config.DB.Query(`SELECT id, full_name, email, phone FROM profiles`)
    if err != nil { log.Fatal(err) }
    for rows.Next() {
        var id string
        var name, email, phone sql.NullString
        rows.Scan(&id, &name, &email, &phone)
        fmt.Printf("ID: %s, Name: %s, Email: %s, Phone: %s\n", id, name.String, email.String, phone.String)
    }
}
