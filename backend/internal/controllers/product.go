package controllers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"
	"xar-backend-go/internal/config"
	"xar-backend-go/internal/models"

	"github.com/gofiber/fiber/v2"
)

// GetProducts handles listing products or retrieving a single product by ID
func GetProducts(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   "Database connection is not initialized",
		})
	}

	rawID := strings.TrimSpace(c.Query("id"))

	// 1. Single Product by ID
	if rawID != "" && rawID != "undefined" && rawID != "null" {
		query := `
			SELECT id, name, description, category, image_url, variants, created_at
			FROM products
			WHERE id::text = $1
			LIMIT 1
		`
		var p models.Product
		var desc, cat, img sql.NullString
		var variantsRaw []byte
		var createdAt sql.NullTime

		err := config.DB.QueryRow(query, rawID).Scan(
			&p.ID,
			&p.Name,
			&desc,
			&cat,
			&img,
			&variantsRaw,
			&createdAt,
		)

		if err != nil {
			if err == sql.ErrNoRows {
				return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
					"success": false,
					"error":   "Produk tidak ditemukan",
				})
			}
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"error":   err.Error(),
			})
		}

		if desc.Valid {
			p.Description = &desc.String
		}
		if cat.Valid {
			p.Category = &cat.String
		}
		if img.Valid {
			p.ImageURL = &img.String
		}
		if len(variantsRaw) > 0 {
			p.Variants = variantsRaw
		} else {
			p.Variants = []byte("[]")
		}
		if createdAt.Valid {
			p.CreatedAt = &createdAt.Time
		}

		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"success": true,
			"data":    p,
		})
	}

	// 2. List Products with search, sort, pagination
	search := strings.TrimSpace(c.Query("search"))
	category := strings.TrimSpace(c.Query("category"))
	status := strings.TrimSpace(c.Query("status"))
	sortBy := strings.TrimSpace(c.Query("sortBy"))
	sortOrder := strings.ToLower(strings.TrimSpace(c.Query("sortOrder")))
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "12"))

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 12
	}
	offset := (page - 1) * limit

	var whereClauses []string
	var args []interface{}
	argIdx := 1

	if search != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("(name ILIKE $%d OR description ILIKE $%d)", argIdx, argIdx))
		args = append(args, "%"+search+"%")
		argIdx++
	}

	if category != "" && category != "all" {
		whereClauses = append(whereClauses, fmt.Sprintf("category = $%d", argIdx))
		args = append(args, category)
		argIdx++
	}

	if status != "" && status != "all" {
		whereClauses = append(whereClauses, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, status)
		argIdx++
	}

	whereSQL := ""
	if len(whereClauses) > 0 {
		whereSQL = "WHERE " + strings.Join(whereClauses, " AND ")
	}

	orderColumn := "created_at"
	ascending := false

	if sortBy == "name" {
		orderColumn = "name"
		ascending = true
	} else if sortBy == "price-low" || sortBy == "price-high" {
		orderColumn = "created_at"
		ascending = false
	}

	if sortOrder == "asc" {
		ascending = true
	} else if sortOrder == "desc" {
		ascending = false
	}

	dir := "DESC"
	if ascending {
		dir = "ASC"
	}

	query := fmt.Sprintf(`
		SELECT id, name, description, category, image_url, variants, created_at,
		       COUNT(*) OVER() AS total_count
		FROM products
		%s
		ORDER BY %s %s
		LIMIT $%d OFFSET $%d
	`, whereSQL, orderColumn, dir, argIdx, argIdx+1)

	args = append(args, limit, offset)

	rows, err := config.DB.Query(query, args...)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   err.Error(),
		})
	}
	defer rows.Close()

	products := make([]models.Product, 0)
	total := 0

	for rows.Next() {
		var p models.Product
		var desc, cat, img sql.NullString
		var variantsRaw []byte
		var createdAt sql.NullTime
		var rowTotal int

		err := rows.Scan(
			&p.ID,
			&p.Name,
			&desc,
			&cat,
			&img,
			&variantsRaw,
			&createdAt,
			&rowTotal,
		)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"error":   err.Error(),
			})
		}

		if desc.Valid {
			p.Description = &desc.String
		}
		if cat.Valid {
			p.Category = &cat.String
		}
		if img.Valid {
			p.ImageURL = &img.String
		}
		if len(variantsRaw) > 0 {
			p.Variants = variantsRaw
		} else {
			p.Variants = []byte("[]")
		}
		if createdAt.Valid {
			p.CreatedAt = &createdAt.Time
		}

		total = rowTotal
		products = append(products, p)
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"success": true,
		"data":    products,
		"total":   total,
	})
}

// GetProductSalesPublic handles retrieving a single product by parameter or query for sales page
func GetProductSalesPublic(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   "Database connection is not initialized",
		})
	}

	id := strings.TrimSpace(c.Params("id"))
	if id == "" {
		id = strings.TrimSpace(c.Query("id"))
	}

	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   "Product ID is required",
		})
	}

	query := `
		SELECT id, name, description, category, image_url, variants, created_at
		FROM products
		WHERE id::text = $1
		LIMIT 1
	`
	var p models.Product
	var desc, cat, img sql.NullString
	var variantsRaw []byte
	var createdAt sql.NullTime

	err := config.DB.QueryRow(query, id).Scan(
		&p.ID,
		&p.Name,
		&desc,
		&cat,
		&img,
		&variantsRaw,
		&createdAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"success": false,
				"error":   "Produk tidak ditemukan",
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   err.Error(),
		})
	}

	if desc.Valid {
		p.Description = &desc.String
	}
	if cat.Valid {
		p.Category = &cat.String
	}
	if img.Valid {
		p.ImageURL = &img.String
	}
	if len(variantsRaw) > 0 {
		p.Variants = variantsRaw
	} else {
		p.Variants = []byte("[]")
	}
	if createdAt.Valid {
		p.CreatedAt = &createdAt.Time
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"success": true,
		"data":    p,
	})
}

// GetProductSales returns summary map of { productId: total_sold }
func GetProductSales(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   "Database connection is not initialized",
		})
	}

	query := `SELECT product_id, total_sold FROM product_sales_summary`
	rows, err := config.DB.Query(query)
	if err != nil {
		// If the view or table doesn't exist, return empty sales map gracefully
		return c.JSON(fiber.Map{
			"success": true,
			"sales":   fiber.Map{},
		})
	}
	defer rows.Close()

	salesMap := make(map[string]int)
	for rows.Next() {
		var pID sql.NullString
		var total sql.NullInt64
		if err := rows.Scan(&pID, &total); err == nil && pID.Valid {
			salesMap[pID.String] = int(total.Int64)
		}
	}

	return c.JSON(fiber.Map{
		"success": true,
		"sales":   salesMap,
	})
}

// CreateProduct creates a new product
func CreateProduct(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	var req map[string]interface{}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid JSON format: " + err.Error()})
	}

	name, _ := req["name"].(string)
	if strings.TrimSpace(name) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Nama produk wajib diisi"})
	}

	desc, _ := req["description"].(string)
	category, _ := req["category"].(string)
	if category == "" {
		category = "Parfum"
	}

	imgURL, _ := req["image_url"].(string)
	if imgURL == "" {
		imgURL, _ = req["imageUrl"].(string)
	}
	imgPublicID, _ := req["image_public_id"].(string)
	if imgPublicID == "" {
		imgPublicID, _ = req["imagePublicId"].(string)
	}

	status, _ := req["status"].(string)
	if status == "" {
		status = "published"
	}

	weight := 250.0
	if w, ok := req["weight"].(float64); ok && w > 0 {
		weight = w
	}
	length, _ := req["length"].(float64)
	width, _ := req["width"].(float64)
	height, _ := req["height"].(float64)

	province, _ := req["province"].(string)
	city, _ := req["city"].(string)
	cityID := ""
	if cid, ok := req["cityId"]; ok && cid != nil {
		cityID = fmt.Sprintf("%v", cid)
	}
	stockLoc, _ := req["stockLocation"].(string)

	variantsJSON, _ := json.Marshal(req["variants"])
	if len(variantsJSON) == 0 || string(variantsJSON) == "null" {
		variantsJSON = []byte("[]")
	}

	query := `
		INSERT INTO products (
			name, description, category, weight, length, width, height,
			status, image_url, image_public_id, variants,
			province, city, "cityId", "stockLocation", updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, $14, $15, NOW())
		RETURNING id, created_at
	`

	var newID string
	var createdAt time.Time
	err := config.DB.QueryRow(
		query,
		name, desc, category, weight, length, width, height,
		status, imgURL, imgPublicID, string(variantsJSON),
		province, city, cityID, stockLoc,
	).Scan(&newID, &createdAt)

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal menyimpan produk: " + err.Error()})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Produk berhasil ditambahkan",
		"product": fiber.Map{
			"id":         newID,
			"name":       name,
			"created_at": createdAt,
		},
	})
}

// UpdateProduct updates an existing product
func UpdateProduct(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	var req map[string]interface{}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid JSON format: " + err.Error()})
	}

	productID, _ := req["productId"].(string)
	if productID == "" {
		productID, _ = req["id"].(string)
	}
	if productID == "" {
		productID = c.Query("id")
	}
	if productID == "" {
		productID = c.Params("id")
	}
	if productID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Product ID is required"})
	}

	name, _ := req["name"].(string)
	if strings.TrimSpace(name) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Nama produk wajib diisi"})
	}

	desc, _ := req["description"].(string)
	category, _ := req["category"].(string)
	if category == "" {
		category = "Parfum"
	}

	imgURL, _ := req["image_url"].(string)
	if imgURL == "" {
		imgURL, _ = req["imageUrl"].(string)
	}
	imgPublicID, _ := req["image_public_id"].(string)
	if imgPublicID == "" {
		imgPublicID, _ = req["imagePublicId"].(string)
	}

	status, _ := req["status"].(string)
	if status == "" {
		status = "published"
	}

	weight := 250.0
	if w, ok := req["weight"].(float64); ok && w > 0 {
		weight = w
	}
	length, _ := req["length"].(float64)
	width, _ := req["width"].(float64)
	height, _ := req["height"].(float64)

	province, _ := req["province"].(string)
	city, _ := req["city"].(string)
	cityID := ""
	if cid, ok := req["cityId"]; ok && cid != nil {
		cityID = fmt.Sprintf("%v", cid)
	}
	stockLoc, _ := req["stockLocation"].(string)

	variantsJSON, _ := json.Marshal(req["variants"])
	if len(variantsJSON) == 0 || string(variantsJSON) == "null" {
		variantsJSON = []byte("[]")
	}

	query := `
		UPDATE products SET
			name = $1,
			description = $2,
			category = $3,
			weight = $4,
			length = $5,
			width = $6,
			height = $7,
			status = $8,
			image_url = COALESCE(NULLIF($9, ''), image_url),
			image_public_id = COALESCE(NULLIF($10, ''), image_public_id),
			variants = $11::jsonb,
			province = $12,
			city = $13,
			"cityId" = $14,
			"stockLocation" = $15,
			updated_at = NOW()
		WHERE id::text = $16
	`

	_, err := config.DB.Exec(
		query,
		name, desc, category, weight, length, width, height,
		status, imgURL, imgPublicID, string(variantsJSON),
		province, city, cityID, stockLoc,
		productID,
	)

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal memperbarui produk: " + err.Error()})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Produk berhasil diperbarui",
	})
}

// DeleteProduct deletes a product
func DeleteProduct(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	id := c.Query("id")
	if id == "" {
		id = c.Params("id")
	}
	if id == "" {
		var req struct {
			ID string `json:"id"`
		}
		_ = c.BodyParser(&req)
		id = req.ID
	}
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Product ID is required"})
	}

	_, err := config.DB.Exec("DELETE FROM products WHERE id::text = $1", id)
	if err != nil {
		if strings.Contains(err.Error(), "violates foreign key constraint") {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Produk tidak bisa dihapus karena sudah ada di pesanan."})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal menghapus produk: " + err.Error()})
	}

	return c.JSON(fiber.Map{"success": true, "message": "Produk berhasil dihapus"})
}
