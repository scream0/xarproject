package routes

import (
	"xar-backend-go/internal/controllers"
	"xar-backend-go/internal/middleware"

	"github.com/gofiber/fiber/v2"
)

// SetupRoutes registers all API routes
func SetupRoutes(app *fiber.App) {
	// Root Welcome Route
	app.Get("/", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":  "online",
			"service": "MAMEKO Backend API (Golang)",
			"version": "1.0.0",
			"health":  "/api/health",
		})
	})

	api := app.Group("/api")

	// ==========================================
	// 1. PUBLIC ROUTES (No Auth Required)
	// ==========================================

	// System & Health
	api.Get("/health", controllers.HealthCheck)
	api.Get("/cron/auto-confirm", controllers.AutoConfirmCron)

	// Auth Webhooks & Gateways
	api.Post("/auth/login", controllers.Login)
	api.Post("/auth/logout", controllers.Logout)
	api.Post("/auth/send-whatsapp-otp", controllers.SendWhatsAppOTP)
	api.Post("/auth/verify-whatsapp-otp", controllers.VerifyWhatsAppOTP)
	api.Post("/webhook/payment", controllers.MidtransPaymentWebhook)
	api.Post("/biteship/webhook", controllers.BiteshipWebhook)
	api.Get("/midtrans", controllers.MidtransInquiry)
	api.Post("/midtrans", controllers.CreateCheckoutTransaction)

	// Settings & Content
	api.Get("/settings", controllers.GetSettings)
	api.Get("/reviews", controllers.GetReviews)
	api.Put("/reviews", middleware.RequireAdmin(), controllers.UpdateReviewStatus)
	api.Delete("/reviews", middleware.RequireAdmin(), controllers.DeleteReview)
	
	// Products
	api.Get("/products", controllers.GetProducts)
	api.Post("/products", middleware.RequireAdmin(), controllers.CreateProduct)
	api.Put("/products", middleware.RequireAdmin(), controllers.UpdateProduct)
	api.Delete("/products", middleware.RequireAdmin(), controllers.DeleteProduct)
	api.Get("/products/sales", controllers.GetProductSales)
	api.Get("/products/sales/public", controllers.GetProductSales)             // return all sales map
	api.Get("/products/sales/public/:id", controllers.GetProductSalesPublic)   // return one product sales
	api.Get("/products/sales/:id", controllers.GetProductSalesPublic)          // return one product sales

	// Vouchers
	api.Get("/vouchers/public", controllers.GetPublicVouchers)

	// Couriers (Ongkir & Biteship)
	api.Get("/ongkir", controllers.CalculateOngkir)
	api.Post("/ongkir", controllers.CalculateOngkir)
	api.Get("/ongkir/cities", controllers.GetCities)
	api.Get("/biteship/areas", controllers.GetBiteshipAreas)
	api.Get("/biteship/couriers", controllers.GetBiteshipCouriers)
	api.Post("/biteship/order", middleware.RequireAdmin(), controllers.CreateBiteshipOrder)
	api.Post("/biteship/order/:id/sync", middleware.RequireAdmin(), controllers.SyncBiteshipOrder)


	// ==========================================
	// 2. USER ROUTES (Requires Login)
	// ==========================================
	userAuth := api.Group("/user", middleware.RequireAuth())

	// Profile & Addresses
	userAuth.Get("/profile", controllers.GetUser)
	userAuth.Post("/profile", controllers.UpdateUser)
	userAuth.Delete("/profile", controllers.DeleteUser)

	// Standard Address Routes
	userAuth.Get("/addresses", controllers.GetAddresses)
	userAuth.Post("/addresses", controllers.CreateAddress)
	userAuth.Put("/addresses/:addressId", controllers.UpdateAddress)
	userAuth.Delete("/addresses/:addressId", controllers.DeleteAddress)

	// Parameterized Address Routes (Backward-compatibility)
	userAuth.Get("/:userId/addresses", controllers.GetAddresses)
	userAuth.Post("/:userId/addresses", controllers.CreateAddress)
	userAuth.Put("/:userId/addresses/:addressId", controllers.UpdateAddress)
	userAuth.Delete("/:userId/addresses/:addressId", controllers.DeleteAddress)

	// Cart
	userAuth.Get("/cart", controllers.GetCart)
	userAuth.Post("/cart", controllers.UpdateCart)
	userAuth.Delete("/cart", controllers.ClearCart)

	// Orders & Returns
	userAuth.Get("/orders", controllers.GetUserOrders)
	userAuth.Post("/orders", controllers.CreateCheckoutTransaction)
	userAuth.Get("/orders/:id", controllers.GetUserOrderDetail)
	userAuth.Post("/orders/:id/pay", controllers.PayOrder)
	userAuth.Post("/orders/:id/cancel", controllers.CancelOrder)
	userAuth.Post("/orders/:id/confirm", controllers.ConfirmOrderReceived)
	userAuth.Post("/orders/:id/return", controllers.RequestOrderReturn)
	userAuth.Post("/orders/:id/sync", controllers.SyncOrderPayment)
	userAuth.Post("/orders/:id/sync-tracking", controllers.SyncBiteshipOrder)
	userAuth.Post("/orders/:id/tracking/sync", controllers.SyncBiteshipOrder)
	userAuth.Get("/returns", controllers.GetUserReturns)

	// Wallet
	userAuth.Get("/wallet", controllers.GetWallet)
	userAuth.Post("/wallet/withdraw", controllers.RequestWithdrawal)

	// Vouchers
	userAuth.Get("/vouchers/available", controllers.GetAvailableVouchers)
	userAuth.Post("/vouchers/claim", controllers.ClaimVoucher)

	// Interactions (Reviews, Notifications, Support, Chat)
	userAuth.Post("/reviews", controllers.CreateReview)
	userAuth.Get("/notifications", controllers.GetNotifications)
	userAuth.Post("/notifications", controllers.CreateNotification)
	userAuth.Put("/notifications", controllers.UpdateNotification)
	userAuth.Delete("/notifications", controllers.DeleteNotification)
	userAuth.Get("/chats", controllers.GetUserChats)
	userAuth.Post("/chats", controllers.UserSendMessage)
	userAuth.Put("/chats/read", controllers.UserMarkAsRead)
	userAuth.Post("/cloudinary", controllers.GenerateCloudinarySignature)
	userAuth.Delete("/cloudinary", controllers.GenerateCloudinarySignature)


	// ==========================================
	// 3. ADMIN ROUTES (Requires Admin Role)
	// ==========================================
	adminAuth := api.Group("/admin", middleware.RequireAdmin())

	// Settings & Automations
	adminAuth.Post("/settings", controllers.UpdateSettings)
	adminAuth.Get("/automation", controllers.GetAutomationRules)
	adminAuth.Post("/automation", controllers.UpdateAutomationRules)

	// Orders, Returns, and Withdrawals (Backoffice)
	adminAuth.Get("/orders", controllers.GetAdminOrders)
	adminAuth.Get("/orders/:id", controllers.GetAdminOrderDetail)
	adminAuth.Post("/orders/run-automation", controllers.RunManualOrderAutomation)
	adminAuth.Put("/orders/:id/shipping", controllers.UpdateAdminOrderShipping)
	adminAuth.Post("/orders/:id/shipping", controllers.UpdateAdminOrderShipping)
	adminAuth.Put("/orders/:id/status", controllers.UpdateAdminOrderStatus)
	adminAuth.Post("/orders/:id/status", controllers.UpdateAdminOrderStatus)
	adminAuth.Post("/orders/:id/sync", controllers.SyncOrderPayment)
	adminAuth.Post("/orders/:id/sync-tracking", controllers.SyncBiteshipOrder)
	adminAuth.Post("/orders/:id/tracking/sync", controllers.SyncBiteshipOrder)
	adminAuth.Get("/returns", controllers.GetAdminReturns)
	adminAuth.Put("/returns/:id", controllers.UpdateAdminReturn)
	adminAuth.Get("/withdrawals", controllers.GetAdminWithdrawals)
	adminAuth.Put("/withdrawals/:id", controllers.UpdateAdminWithdrawal)
	adminAuth.Put("/reviews", controllers.UpdateReviewStatus)
	adminAuth.Delete("/reviews", controllers.DeleteReview)

	// Products & Procurement
	adminAuth.Get("/products/sales", controllers.GetProductSales)
	adminAuth.Get("/procurement", controllers.GetProcurement)
	adminAuth.Post("/procurement", controllers.CreateProcurement)
	adminAuth.Put("/procurement", controllers.UpdateProcurement)
	adminAuth.Delete("/procurement", controllers.DeleteProcurement)
	adminAuth.Get("/reconciliation", controllers.GetReconciliation)

	// Team Management
	adminAuth.Get("/team", controllers.GetTeamMembers)
	adminAuth.Put("/team", controllers.UpdateTeamMember)
	adminAuth.Post("/team", controllers.CreateTeamMember)
	adminAuth.Delete("/team", controllers.DeleteTeamMember)
	adminAuth.Delete("/team/:id", controllers.DeleteTeamMember)

	// Biteship Admin Actions
	adminAuth.Post("/biteship/order", controllers.CreateBiteshipOrder)
	adminAuth.Post("/biteship/order/:id/sync", controllers.SyncBiteshipOrder)
	adminAuth.Get("/biteship/cron/sync", controllers.BiteshipCronSync)
	
	// Notifications (Admin view and create)
	adminAuth.Get("/notifications", controllers.GetNotifications)
	adminAuth.Post("/notifications", controllers.CreateNotification)
	adminAuth.Put("/notifications", controllers.UpdateNotification)
	adminAuth.Delete("/notifications", controllers.DeleteNotification)

	// Chat (Admin view and create)
	adminAuth.Get("/chats", controllers.AdminGetChatList)
	adminAuth.Get("/chats/:userId", controllers.AdminGetUserChats)
	adminAuth.Post("/chats", controllers.AdminSendMessage)
	adminAuth.Put("/chats/:userId/read", controllers.AdminMarkAsRead)

	// Vouchers (Admin view, create, update, delete)
	adminAuth.Get("/vouchers", controllers.GetAdminVouchers)
	adminAuth.Post("/vouchers", controllers.CreateVoucher)
	adminAuth.Put("/vouchers", controllers.UpdateVoucher)
	adminAuth.Put("/vouchers/:id", controllers.UpdateVoucher)
	adminAuth.Delete("/vouchers", controllers.DeleteVoucher)
	adminAuth.Delete("/vouchers/:id", controllers.DeleteVoucher)
}
