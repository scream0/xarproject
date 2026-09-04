package main

import (
	"encoding/json"
	"fmt"
	"xar-backend-go/internal/config"
	"github.com/joho/godotenv"
	"database/sql"
	"time"
)

func main() {
	godotenv.Load("../.env.local")
	config.ConnectDB()

	rows, err := config.DB.Query(`
		SELECT 
			p.id, p.full_name, p.email, p.role, p.status, p.created_at,
			COALESCE(SUM(o.total_amount), 0) as total_spent,
			COUNT(o.id) as total_orders
		FROM profiles p
		LEFT JOIN orders o ON p.id = o.user_id AND o.status IN ('paid', 'shipped', 'delivered', 'completed')
		GROUP BY p.id, p.full_name, p.email, p.role, p.status, p.created_at
		ORDER BY p.created_at DESC
	`)
	if err != nil {
		fmt.Println("GetTeamMembers DB Query Error:", err)
		return
	}
	defer rows.Close()

	team := make([]map[string]interface{}, 0)
	for rows.Next() {
		var id string
		var fName, email, role, status sql.NullString
		var cAt sql.NullTime
		var totalSpent float64
		var totalOrders int
		if err := rows.Scan(&id, &fName, &email, &role, &status, &cAt, &totalSpent, &totalOrders); err == nil {
			roleStr := role.String
			if roleStr == "" {
				roleStr = "customer"
			}
			var createdAt time.Time
			if cAt.Valid {
				createdAt = cAt.Time
			} else {
				createdAt = time.Now()
			}
			
			statusStr := status.String
			if statusStr == "" {
				statusStr = "active"
			}
			
			team = append(team, map[string]interface{}{
				"id":          id,
				"name":        fName.String,
				"email":       email.String,
				"role":        roleStr,
				"status":      statusStr,
				"createdAt":   createdAt,
				"totalSpent":  totalSpent,
				"totalOrders": totalOrders,
			})
		} else {
			fmt.Println("GetTeamMembers Scan Error:", err)
		}
	}

	b, _ := json.MarshalIndent(team, "", "  ")
	fmt.Println(string(b))
}
