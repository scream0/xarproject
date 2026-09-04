package controllers

import (
	"encoding/json"
	"fmt"
	"strings"
	"xar-backend-go/internal/config"
	"xar-backend-go/internal/models"

	"github.com/gofiber/fiber/v2"
)

var defaultSettingsJSON = `{
	"storeName": "MAMEKO Perfume",
	"storeEmail": "contact@mameko.my.id",
	"currency": "IDR",
	"adminLocale": "id",
	"lowStockThreshold": 10,
	"storeCityId": "",
	"storeCityName": "",
	"enableMidtrans": true,
	"enableManualTransfer": false,
	"midtransIsProduction": false,
	"biteshipIsProduction": false,
	"biteshipAutoOrder": false,
	"hero": {
		"tagline": "Artisanal Craftsmanship",
		"title": { "main": "Meracik Batas Antara", "highlight": "Aroma & Rasa" },
		"description": {
			"prefix": "Eksplorasi mahakarya ",
			"italic": "Extrait de Parfum",
			"suffix": " berkonsentrasi tinggi dan kopi arabica pilihan. Dibuat manual dalam jumlah terbatas untuk Anda yang menghargai identitas."
		},
		"buttons": {
			"primary": { "label": "Jelajahi Koleksi", "href": "#product" },
			"secondary": { "label": "The Story", "href": "#about" }
		}
	},
	"about": {
		"image": "/assets/images/about-bg.jpg",
		"imageAlt": "Artisanal Craftsmanship",
		"imagePublicId": "",
		"content": {
			"tagline": "The Story Behind",
			"heading": "The Essence of Artisanal Perfection.",
			"leadText": "MAMEKO mendefinisikan ulang kemewahan melalui keheningan aroma dan kedalaman karakter yang terakurasi.",
			"bodyText": "Kami percaya bahwa apa yang Anda kenakan adalah representasi paling jujur dari identitas diri. Setiap rilisan diracik secara manual dalam jumlah terbatas untuk memastikan eksklusivitas."
		},
		"features": [
			{ "number": "01", title: "Premium Concentration", desc: "Konsentrat tertinggi untuk ketahanan aroma sepanjang hari." },
			{ "number": "02", title: "Artisanal Blend", desc: "Racikan manual yang menjaga keaslian setiap karakter aroma." }
		]
	},
	"product": {
		"header": {
			"tagline": "our curated collection",
			"title": { "main": "Produk", "highlight": "Kami" }
		}
	},
	"contact": {
		"whatsappNumber": "6285171723607",
		"header": {
			"tagline": "Get In Touch",
			"title": { "main": "Ada Pertanyaan?", "highlight": "Hubungi Kami" }
		},
		"infoItems": [
			{ "icon": "mail", "title": "Email Resmi", "value": "support@mameko.my.id" },
			{ "icon": "clock", "title": "Jam Operasional", "value": "Setiap Hari (18:00 - 21:00 WIB)" },
			{ "icon": "map-pin", "title": "Lokasi Galeri", "value": "Sleman, Yogyakarta, Indonesia" }
		],
		"headquarters": {
			"title": "Headquarters",
			"address": ["Tegalrejo Wedomartani, Kabupaten Sleman,", "Daerah Istimewa Yogyakarta 55584"],
			"coordinates": "07° 43' 36.2\" S | 110° 25' 35.3\" E"
		},
		"form": {
			"title": "Kirim Pesan Instan",
			"fields": { "name": "Nama Lengkap", "email": "Alamat Email", "phone": "Nomor WhatsApp", "message": "Tulis Pesan Anda..." },
			"submitText": "Kirim via WhatsApp"
		},
		"bankAccounts": [
			{ "id": "1", "bankName": "BCA", "accountNumber": "123456789", "accountName": "PT Mameko Store" },
			{ "id": "2", "bankName": "Bank Mandiri", "accountNumber": "0987654321", "accountName": "PT Mameko Store" }
		]
	},
	"footer": {
		"branding": {
			"logo": { "text": "MAKE ", "subtext": "ME KOOL", "href": "#" },
			"description": "Meracik setiap produk dengan penuh perhatian untuk memberikan kualitas aroma dan rasa terbaik langsung ke tangan Anda.",
			"socials": [
				{ "href": "https://www.instagram.com/mameko.id/", "icon": "instagram", "label": "Instagram" },
				{ "href": "#product", "icon": "shopping-bag", "label": "Shop" }
			]
		},
		"navigation": {
			"title": "Penjelajahan",
			"links": [
				{ "label": "Home", "href": "#home" },
				{ "label": "Tentang Kami", "href": "#about" },
				{ "label": "Produk", "href": "#product" },
				{ "label": "Kontak", "href": "#contact" }
			]
		},
		"payment": {
			"title": "Pembayaran",
			"subtitle": "Didukung secara aman oleh:",
			"methods": ["Midtrans", "QRIS"]
		},
		"copyright": { "text": "Make Me Kool. All rights reserved." }
	},
	"promoBannerEnabled": false,
	"promoBannerText": "Diskon khusus untuk pelanggan setia",
	"promoDiscountType": "percentage",
	"promoDiscountValue": 0,
	"promoStartDate": "",
	"promoEndDate": "",
	"promoCode": "",
	"promoDestination": "#product",
	"activeCouriers": ["jne", "jnt", "sicepat", "anteraja"]
}`

// GetSettings fetches store settings dynamically from database
func GetSettings(c *fiber.Ctx) error {
	var def models.StoreSettings
	_ = json.Unmarshal([]byte(defaultSettingsJSON), &def)

	if config.DB == nil {
		return c.JSON(def)
	}

	rows, err := config.DB.Query("SELECT * FROM store_config WHERE id = 'main' LIMIT 1")
	if err != nil {
		return c.JSON(def)
	}
	defer rows.Close()

	if !rows.Next() {
		return c.JSON(def)
	}

	cols, err := rows.Columns()
	if err != nil {
		return c.JSON(def)
	}

	values := make([]interface{}, len(cols))
	valuePtrs := make([]interface{}, len(cols))
	for i := range values {
		valuePtrs[i] = &values[i]
	}

	if err := rows.Scan(valuePtrs...); err != nil {
		return c.JSON(def)
	}

	rowMap := make(map[string]interface{})
	for i, col := range cols {
		val := values[i]
		if b, ok := val.([]byte); ok {
			var js interface{}
			if err := json.Unmarshal(b, &js); err == nil {
				rowMap[col] = js
			} else {
				rowMap[col] = string(b)
			}
		} else {
			rowMap[col] = val
		}
	}

	// Map into struct
	s := def
	if val, ok := rowMap["store_name"].(string); ok && val != "" {
		s.StoreName = val
	}
	if val, ok := rowMap["store_email"].(string); ok && val != "" {
		s.StoreEmail = val
	}
	if val, ok := rowMap["currency"].(string); ok && val != "" {
		s.Currency = val
	}
	if val, ok := rowMap["store_city_id"]; ok && val != nil {
		s.StoreCityID = strings.TrimSpace(fmt.Sprintf("%v", val))
	}
	if val, ok := rowMap["store_city_name"].(string); ok {
		s.StoreCityName = val
	}
	if val, ok := rowMap["enable_midtrans"].(bool); ok {
		s.EnableMidtrans = val
	}
	if val, ok := rowMap["enable_manual_transfer"].(bool); ok {
		s.EnableManualTransfer = val
	}
	if val, ok := rowMap["midtrans_is_production"].(bool); ok {
		s.MidtransIsProduction = val
	}
	if val, ok := rowMap["biteship_is_production"].(bool); ok {
		s.BiteshipIsProduction = val
	}
	if val, ok := rowMap["biteship_auto_order"].(bool); ok {
		s.BiteshipAutoOrder = val
	}
	if val, ok := rowMap["hero"]; ok && val != nil {
		if b, err := json.Marshal(val); err == nil {
			s.Hero = b
		}
	}
	if val, ok := rowMap["about"]; ok && val != nil {
		if b, err := json.Marshal(val); err == nil {
			s.About = b
		}
	}
	if val, ok := rowMap["product"]; ok && val != nil {
		if b, err := json.Marshal(val); err == nil {
			s.Product = b
		}
	}
	if val, ok := rowMap["contact"]; ok && val != nil {
		if b, err := json.Marshal(val); err == nil {
			s.Contact = b
		}
	}
	if val, ok := rowMap["footer"]; ok && val != nil {
		if b, err := json.Marshal(val); err == nil {
			s.Footer = b
		}
	}
	if val, ok := rowMap["active_couriers"]; ok && val != nil {
		if b, err := json.Marshal(val); err == nil {
			s.ActiveCouriers = b
		}
	}

	return c.JSON(s)
}

// UpdateSettings saves updated store settings
func UpdateSettings(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Database not connected",
		})
	}

	var req models.StoreSettings
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body: " + err.Error(),
		})
	}

	safeJSON := func(b []byte) string {
		s := string(b)
		if s == "" || s == "null" {
			return "{}"
		}
		return s
	}

	heroStr := safeJSON(req.Hero)
	aboutStr := safeJSON(req.About)
	productStr := safeJSON(req.Product)
	contactStr := safeJSON(req.Contact)
	footerStr := safeJSON(req.Footer)
	
	couriersStr := string(req.ActiveCouriers)
	if couriersStr == "" || couriersStr == "null" {
		couriersStr = "[]"
	}

	query := `
		INSERT INTO store_config (
			id, store_name, store_email, currency, low_stock_threshold,
			store_city_id, store_city_name, enable_midtrans, enable_manual_transfer,
			midtrans_is_production, biteship_is_production, biteship_auto_order,
			hero, about, product, contact, footer, active_couriers,
			updated_at
		) VALUES (
			'main', $1, $2, $3, $4,
			$5, $6, $7, $8,
			$9, $10, $11,
			$12::jsonb, $13::jsonb, $14::jsonb, $15::jsonb, $16::jsonb, $17::jsonb,
			NOW()
		)
		ON CONFLICT (id) DO UPDATE SET
			store_name = EXCLUDED.store_name,
			store_email = EXCLUDED.store_email,
			currency = EXCLUDED.currency,
			low_stock_threshold = EXCLUDED.low_stock_threshold,
			store_city_id = EXCLUDED.store_city_id,
			store_city_name = EXCLUDED.store_city_name,
			enable_midtrans = EXCLUDED.enable_midtrans,
			enable_manual_transfer = EXCLUDED.enable_manual_transfer,
			midtrans_is_production = EXCLUDED.midtrans_is_production,
			biteship_is_production = EXCLUDED.biteship_is_production,
			biteship_auto_order = EXCLUDED.biteship_auto_order,
			hero = EXCLUDED.hero,
			about = EXCLUDED.about,
			product = EXCLUDED.product,
			contact = EXCLUDED.contact,
			footer = EXCLUDED.footer,
			active_couriers = EXCLUDED.active_couriers,
			updated_at = NOW()
	`

	_, err := config.DB.Exec(
		query,
		req.StoreName, req.StoreEmail, req.Currency, req.LowStockThreshold,
		req.StoreCityID, req.StoreCityName, req.EnableMidtrans, req.EnableManualTransfer,
		req.MidtransIsProduction, req.BiteshipIsProduction, req.BiteshipAutoOrder,
		heroStr, aboutStr, productStr, contactStr, footerStr, couriersStr,
	)

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to save settings: " + err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Settings updated successfully",
	})
}
