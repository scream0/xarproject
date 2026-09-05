//go:build ignore

package main
import ("fmt"; "log"; "xar-backend-go/internal/config"; "github.com/joho/godotenv")
func main() {
    godotenv.Load("../../../.env.local")
    config.ConnectDB()
    rows, err := config.DB.Query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'orders'`)
    if err != nil { log.Fatal(err) }
    for rows.Next() {
        var colName, dataType string
        rows.Scan(&colName, &dataType)
        fmt.Println(colName, "-", dataType)
    }
}
