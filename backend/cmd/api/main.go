package main

import (
	"log"
	"os"
	"path/filepath"
	"runtime"
	"xar-backend-go/internal/config"
	"xar-backend-go/internal/routes"
	"xar-backend-go/internal/services"
	"xar-backend-go/internal/whatsapp"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/joho/godotenv"
)

func main() {
	// Load .env.local — coba beberapa path relatif agar bisa dijalankan
	// dari backend/, backend/cmd/api/, maupun via 'go run' dari mana pun.
	_, thisFile, _, _ := runtime.Caller(0)
	// thisFile = .../backend/cmd/api/main.go → naik 3 level ke project root
	projectRoot := filepath.Join(filepath.Dir(thisFile), "..", "..", "..")

	envPaths := []string{
		".env.local",                                  // production / env sudah di-set
		"../.env.local",                               // run dari backend/
		"../../.env.local",                            // run dari backend/cmd/
		"../../../.env.local",                         // run dari backend/cmd/api/
		filepath.Join(projectRoot, ".env.local"),      // absolute via runtime.Caller
	}

	loaded := false
	for _, p := range envPaths {
		if _, err := os.Stat(p); err == nil {
			if err2 := godotenv.Load(p); err2 == nil {
				log.Printf("✅ .env.local loaded from: %s", p)
				loaded = true
				break
			}
		}
	}
	if !loaded {
		log.Println("⚠️  .env.local tidak ditemukan, menggunakan environment variables sistem")
	}

	// Connect to PostgreSQL (Raw SQL)
	config.ConnectDB()

	// Start Background Order Automation Worker (Auto-cancel >24h, Auto-complete >14d)
	services.StartOrderAutomationWorker(config.DB)

	// Initialize WhatsApp (whatsmeow)
	go func() {
		if err := whatsapp.InitWhatsApp(); err != nil {
			log.Printf("⚠️ WhatsApp Gateway gagal mulai: %v\n", err)
		}
	}()

	app := fiber.New(fiber.Config{
		AppName:         "MAMEKO Backend API",
		ReadBufferSize:  32 * 1024,        // 32 KB (mencegah HTTP 431 untuk header/cookie besar)
		WriteBufferSize: 32 * 1024,        // 32 KB
		BodyLimit:       20 * 1024 * 1024, // 20 MB
	})

	// Middleware
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
	}))

	// Setup Routes
	routes.SetupRoutes(app)

	// Start server on port 8080, specifically on 127.0.0.1
	log.Fatal(app.Listen("127.0.0.1:8080"))
}
