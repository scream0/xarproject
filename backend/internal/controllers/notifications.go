package controllers

import (
	"database/sql"
	"strings"
	"xar-backend-go/internal/config"
	"xar-backend-go/internal/middleware"
	"xar-backend-go/internal/models"

	"github.com/gofiber/fiber/v2"
)

// GetNotifications retrieves notifications for the authenticated user or admin
func GetNotifications(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	authHeader := c.Get("Authorization")
	user, err := middleware.ParseSupabaseToken(authHeader)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Authentication required"})
	}

	scope := strings.TrimSpace(c.Query("scope", "mine"))
	isAdmin := user.Role == "admin" || user.Role == "superadmin"

	var query string
	var args []interface{}

	if isAdmin && scope != "mine" {
		query = `
			SELECT id, user_id, title, message, type, link, audience, is_read, created_at
			FROM notifications
			WHERE audience = 'admin' OR user_id IS NULL OR user_id::text = $1
			ORDER BY created_at DESC
			LIMIT 100
		`
		args = append(args, user.ID)
	} else {
		query = `
			SELECT id, user_id, title, message, type, link, audience, is_read, created_at
			FROM notifications
			WHERE user_id::text = $1 OR (user_id IS NULL AND (audience = 'all' OR audience = 'user'))
			ORDER BY created_at DESC
			LIMIT 100
		`
		args = append(args, user.ID)
	}

	rows, err := config.DB.Query(query, args...)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	notifications := make([]models.Notification, 0)
	var broadcastIDs []string

	for rows.Next() {
		var n models.Notification
		var uID, nType, link, aud sql.NullString
		var isRead sql.NullBool
		var cAt sql.NullTime

		err := rows.Scan(
			&n.ID, &uID, &n.Title, &n.Message, &nType, &link, &aud, &isRead, &cAt,
		)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}

		if uID.Valid {
			n.UserID = &uID.String
		} else {
			broadcastIDs = append(broadcastIDs, n.ID)
		}
		if nType.Valid {
			n.Type = &nType.String
		}
		if link.Valid {
			n.Link = &link.String
		}
		if aud.Valid {
			n.Audience = &aud.String
		}
		if isRead.Valid {
			n.IsRead = isRead.Bool
		}
		if cAt.Valid {
			n.CreatedAt = &cAt.Time
		}

		notifications = append(notifications, n)
	}
	if err := rows.Err(); err != nil {
		_ = err // ignored or handle appropriately
	}

	// Check read status for broadcast notifications
	if len(broadcastIDs) > 0 {
		readMap := make(map[string]bool)
		readRows, err := config.DB.Query(
			"SELECT notification_id FROM notification_reads WHERE user_id = $1",
			user.ID,
		)
		if err == nil {
			defer readRows.Close()
			for readRows.Next() {
				var nID string
				if err := readRows.Scan(&nID); err == nil {
					readMap[nID] = true
				}
			}
			if err := readRows.Err(); err != nil {
				_ = err // ignored or handle appropriately
			}
		}

		for i := range notifications {
			if notifications[i].UserID == nil && readMap[notifications[i].ID] {
				notifications[i].IsRead = true
			}
		}
	}

	return c.JSON(fiber.Map{"notifications": notifications})
}

// CreateNotification inserts a new notification
func CreateNotification(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	authHeader := c.Get("Authorization")
	user, err := middleware.ParseSupabaseToken(authHeader)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Authentication required"})
	}

	var req models.CreateNotificationRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.Title == "" || req.Message == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "title and message are required"})
	}

	isAdmin := user.Role == "admin" || user.Role == "superadmin"
	var targetUserID *string
	targetAudience := "user"

	if isAdmin && req.UserID != nil && *req.UserID != "" {
		targetUserID = req.UserID
	} else if !isAdmin {
		targetUserID = &user.ID
	}

	if isAdmin && req.Audience != nil && *req.Audience != "" {
		targetAudience = *req.Audience
	}

	query := `
		INSERT INTO notifications (
			user_id, title, message, type, link, audience, is_read, created_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, false, NOW()
		)
	`
	_, err = config.DB.Exec(
		query,
		targetUserID, req.Title, req.Message, req.Type, req.Link, targetAudience,
	)

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create notification: " + err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"message": "Notification created successfully",
	})
}

// UpdateNotification marks a notification as read
func UpdateNotification(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	authHeader := c.Get("Authorization")
	user, err := middleware.ParseSupabaseToken(authHeader)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Authentication required"})
	}

	var req struct {
		NotificationID string `json:"notificationId"`
		ID             string `json:"id"`
		IsRead         bool   `json:"isRead"`
		MarkAllAsRead  bool   `json:"markAllAsRead"`
		Action         string `json:"action"`
	}
	_ = c.BodyParser(&req)

	isMarkAll := req.MarkAllAsRead || req.Action == "mark_all_read" || req.Action == "read_all" || c.Query("all") == "true" || c.Query("markAll") == "true"

	isAdmin := user.Role == "admin" || user.Role == "superadmin"

	if isMarkAll {
		if isAdmin {
			_, err = config.DB.Exec(`UPDATE notifications SET is_read = true WHERE (audience = 'admin' OR user_id::text = $1) AND is_read = false`, user.ID)
		} else {
			_, err = config.DB.Exec(`UPDATE notifications SET is_read = true WHERE (user_id::text = $1 OR user_id IS NULL) AND is_read = false`, user.ID)
		}
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to mark all as read: " + err.Error()})
		}
		return c.JSON(fiber.Map{"success": true, "message": "All notifications marked as read"})
	}

	notifID := req.NotificationID
	if notifID == "" {
		notifID = req.ID
	}
	if notifID == "" {
		notifID = c.Params("id")
	}
	if notifID == "" {
		notifID = c.Query("id")
	}
	if notifID == "" {
		notifID = c.Query("notificationId")
	}
	if notifID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Notification ID required"})
	}

	_, err = config.DB.Exec(`UPDATE notifications SET is_read = true WHERE id::text = $1`, notifID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update notification: " + err.Error()})
	}

	return c.JSON(fiber.Map{"success": true, "message": "Notification marked as read"})
}

// DeleteNotification deletes a notification
func DeleteNotification(c *fiber.Ctx) error {
	if config.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database not initialized"})
	}

	id := c.Query("id")
	if id == "" {
		id = c.Params("id")
	}
	if id == "" {
		var req struct {
			ID             string `json:"id"`
			NotificationID string `json:"notificationId"`
		}
		_ = c.BodyParser(&req)
		id = req.ID
		if id == "" {
			id = req.NotificationID
		}
	}
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Notification ID is required"})
	}

	_, err := config.DB.Exec(`DELETE FROM notifications WHERE id::text = $1`, id)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete notification"})
	}

	return c.JSON(fiber.Map{"success": true, "message": "Notification deleted successfully"})
}
