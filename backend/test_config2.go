package main

import (
	"encoding/json"
	"fmt"
	"xar-backend-go/internal/config"
	"github.com/joho/godotenv"
)

func main() {
	godotenv.Load("../.env.local")
	godotenv.Load(".env")

	config.ConnectDB()

	rows, _ := config.DB.Query("SELECT * FROM store_config LIMIT 1")
	cols, _ := rows.Columns()
	fmt.Println("Columns:", cols)
	
	if rows.Next() {
		vals := make([]interface{}, len(cols))
		for i := range cols {
			vals[i] = new(interface{})
		}
		rows.Scan(vals...)
		
		for i, col := range cols {
			v := *(vals[i].(*interface{}))
			b, _ := json.Marshal(v)
			fmt.Printf("%s: %s\n", col, string(b))
		}
	}
}
