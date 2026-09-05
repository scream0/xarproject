package controllers

import (
	"fmt"
	"log"
	"strings"
	"xar-backend-go/internal/config"
	"xar-backend-go/internal/middleware"
	"xar-backend-go/internal/models"

	"github.com/gofiber/fiber/v2"
)

// --- USER ENDPOINTS ---

// GetUserChats fetches the chat history for the logged-in user
func GetUserChats(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	user, ok := c.Locals("user").(*middleware.AuthUser)
	if !ok || user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	query := `
		SELECT id, user_id, message, image_url, sender_role, is_read, created_at
		FROM chats
		WHERE user_id = $1
		ORDER BY created_at ASC
	`
	rows, err := config.DB.Query(query, user.ID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	var chats []models.Chat
	for rows.Next() {
		var chat models.Chat
		if err := rows.Scan(&chat.ID, &chat.UserID, &chat.Message, &chat.ImageURL, &chat.SenderRole, &chat.IsRead, &chat.CreatedAt); err != nil {
			continue
		}
		chats = append(chats, chat)
	}
	if err := rows.Err(); err != nil {
		_ = err // ignored or handle appropriately
	}

	return c.JSON(fiber.Map{"success": true, "data": chats})
}

// UserSendMessage sends a message from a user
func UserSendMessage(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	user, ok := c.Locals("user").(*middleware.AuthUser)
	if !ok || user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req map[string]interface{}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid format"})
	}

	message, _ := req["message"].(string)
	imgURL, _ := req["image_url"].(string)

	if strings.TrimSpace(message) == "" && imgURL == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Message or image is required"})
	}

	query := `
		INSERT INTO chats (user_id, message, image_url, sender_role, is_read)
		VALUES ($1, $2, NULLIF($3, ''), 'user', false)
		RETURNING id, created_at
	`
	var chat models.Chat
	err := config.DB.QueryRow(query, user.ID, message, imgURL).Scan(&chat.ID, &chat.CreatedAt)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	chat.UserID = user.ID
	chat.Message = message
	if imgURL != "" {
		chat.ImageURL = &imgURL
	}
	chat.SenderRole = "user"
	chat.IsRead = false

	return c.JSON(fiber.Map{"success": true, "data": chat})
}

// UserMarkAsRead marks all admin messages as read for this user
func UserMarkAsRead(c *fiber.Ctx) error {
	user, ok := c.Locals("user").(*middleware.AuthUser)
	if !ok || user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req map[string]interface{}
	c.BodyParser(&req)
	
	// Optional: mark specific IDs if provided, else mark all unread from admin
	ids, _ := req["ids"].([]interface{})
	if len(ids) > 0 {
		var strIds []string
		for _, id := range ids {
			strIds = append(strIds, fmt.Sprintf("'%s'", id))
		}
		query := fmt.Sprintf(`UPDATE chats SET is_read = true WHERE user_id = $1 AND sender_role = 'admin' AND id IN (%s)`, strings.Join(strIds, ","))
		_, _ = config.DB.Exec(query, user.ID)
	} else {
		_, _ = config.DB.Exec(`UPDATE chats SET is_read = true WHERE user_id = $1 AND sender_role = 'admin'`, user.ID)
	}
	
	return c.JSON(fiber.Map{"success": true})
}

// --- ADMIN ENDPOINTS ---

// AdminGetChatList gets the list of users who have chatted
func AdminGetChatList(c *fiber.Ctx) error {
	query := `
		SELECT 
			c.user_id, 
			MAX(c.created_at) as last_activity, 
			COUNT(CASE WHEN c.is_read = false AND c.sender_role = 'user' THEN 1 END) as unread_count,
			COALESCE(p.full_name, (au.raw_user_meta_data->>'full_name')::text, (au.raw_user_meta_data->>'name')::text, au.email) as full_name,
			COALESCE(p.avatar_url, (au.raw_user_meta_data->>'avatar_url')::text, (au.raw_user_meta_data->>'picture')::text) as avatar_url,
			au.email,
			(SELECT message FROM chats WHERE user_id = c.user_id ORDER BY created_at DESC LIMIT 1) as last_message,
			(SELECT image_url FROM chats WHERE user_id = c.user_id ORDER BY created_at DESC LIMIT 1) as last_image
		FROM chats c
		LEFT JOIN profiles p ON c.user_id::text = p.id::text
		LEFT JOIN auth.users au ON c.user_id::text = au.id::text
		GROUP BY c.user_id, p.full_name, p.avatar_url, au.raw_user_meta_data, au.email
		ORDER BY last_activity DESC
	`
	rows, err := config.DB.Query(query)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	var list []map[string]interface{}
	for rows.Next() {
		var userID string
		var lastActivity string
		var unreadCount int
		var fullName *string
		var avatarURL *string
		var email *string
		var lastMessage *string
		var lastImage *string
		
		if err := rows.Scan(&userID, &lastActivity, &unreadCount, &fullName, &avatarURL, &email, &lastMessage, &lastImage); err != nil {
			log.Printf("AdminGetChatList Scan error: %v", err)
			continue
		}
		list = append(list, map[string]interface{}{
			"user_id":       userID,
			"last_activity": lastActivity,
			"unread_count":  unreadCount,
			"full_name":     fullName,
			"avatar_url":    avatarURL,
			"email":         email,
			"last_message":  lastMessage,
			"last_image":    lastImage,
		})
	}
	if err := rows.Err(); err != nil {
		_ = err // ignored or handle appropriately
	}

	return c.JSON(fiber.Map{"success": true, "data": list})
}

// AdminGetUserChats gets the chat history for a specific user ID
func AdminGetUserChats(c *fiber.Ctx) error {
	userID := c.Params("userId")
	if userID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "userId is required"})
	}

	query := `
		SELECT id, user_id, message, image_url, sender_role, is_read, created_at
		FROM chats
		WHERE user_id = $1
		ORDER BY created_at ASC
	`
	rows, err := config.DB.Query(query, userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	var chats []models.Chat
	for rows.Next() {
		var chat models.Chat
		if err := rows.Scan(&chat.ID, &chat.UserID, &chat.Message, &chat.ImageURL, &chat.SenderRole, &chat.IsRead, &chat.CreatedAt); err != nil {
			continue
		}
		chats = append(chats, chat)
	}
	if err := rows.Err(); err != nil {
		_ = err // ignored or handle appropriately
	}

	return c.JSON(fiber.Map{"success": true, "data": chats})
}

// AdminSendMessage sends a message to a user as an admin
func AdminSendMessage(c *fiber.Ctx) error {
	var req map[string]interface{}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid format"})
	}

	userID, _ := req["user_id"].(string)
	message, _ := req["message"].(string)
	imgURL, _ := req["image_url"].(string)

	if userID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "user_id is required"})
	}
	if strings.TrimSpace(message) == "" && imgURL == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Message or image is required"})
	}

	query := `
		INSERT INTO chats (user_id, message, image_url, sender_role, is_read)
		VALUES ($1, $2, NULLIF($3, ''), 'admin', false)
		RETURNING id, created_at
	`
	var chat models.Chat
	err := config.DB.QueryRow(query, userID, message, imgURL).Scan(&chat.ID, &chat.CreatedAt)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	chat.UserID = userID
	chat.Message = message
	if imgURL != "" {
		chat.ImageURL = &imgURL
	}
	chat.SenderRole = "admin"
	chat.IsRead = false

	return c.JSON(fiber.Map{"success": true, "data": chat})
}

// AdminMarkAsRead marks all user messages as read for a specific user
func AdminMarkAsRead(c *fiber.Ctx) error {
	userID := c.Params("userId")
	if userID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "userId is required"})
	}

	var req map[string]interface{}
	c.BodyParser(&req)

	// Optional: mark specific IDs if provided, else mark all unread from user
	ids, _ := req["ids"].([]interface{})
	if len(ids) > 0 {
		var strIds []string
		for _, id := range ids {
			strIds = append(strIds, fmt.Sprintf("'%s'", id))
		}
		query := fmt.Sprintf(`UPDATE chats SET is_read = true WHERE user_id = $1 AND sender_role = 'user' AND id IN (%s)`, strings.Join(strIds, ","))
		_, _ = config.DB.Exec(query, userID)
	} else {
		_, _ = config.DB.Exec(`UPDATE chats SET is_read = true WHERE user_id = $1 AND sender_role = 'user'`, userID)
	}
	
	return c.JSON(fiber.Map{"success": true})
}
