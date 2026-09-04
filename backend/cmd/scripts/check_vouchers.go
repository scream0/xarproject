package main
import ("fmt"; "log"; "xar-backend-go/internal/config"; "github.com/joho/godotenv")
func main() {
    godotenv.Load("../../../.env.local")
    config.ConnectDB()
    rows, err := config.DB.Query("SELECT id, code, title FROM vouchers")
    if err != nil { log.Fatal(err) }
    for rows.Next() {
        var id, code, title string
        rows.Scan(&id, &code, &title)
        fmt.Println(id, code, title)
    }
}
