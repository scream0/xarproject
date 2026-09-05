//go:build ignore

package main
import ("fmt"; "log"; "xar-backend-go/internal/config"; "github.com/joho/godotenv"; "database/sql")
func main() {
    godotenv.Load("../../../.env.local")
    config.ConnectDB()
    rows, err := config.DB.Query(`
		SELECT 
			p.id, p.full_name, p.email, p.phone, p.role, p.status, p.created_at,
			COALESCE(SUM(o.total_amount), 0) as total_spent,
			COUNT(o.id) as total_orders
		FROM profiles p
		LEFT JOIN orders o ON p.id = o.user_id AND o.status IN ('paid', 'shipped', 'delivered', 'completed')
		GROUP BY p.id, p.full_name, p.email, p.phone, p.role, p.status, p.created_at
		ORDER BY p.created_at DESC
	`)
    if err != nil { log.Fatal(err) }
    for rows.Next() {
        var id string
        var name, email, phone, role, status sql.NullString
		var createdAt sql.NullTime
		var totalSpent float64
		var totalOrders int
        err := rows.Scan(&id, &name, &email, &phone, &role, &status, &createdAt, &totalSpent, &totalOrders)
		if err != nil { log.Println("Scan error:", err) }
        fmt.Printf("ID: %s, Name: %s, Spent: %f, Orders: %d\n", id, name.String, totalSpent, totalOrders)
    }
}
