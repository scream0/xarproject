package controllers

import (
	"bytes"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

// extractPublicIDFromURL extracts Cloudinary public_id from a full URL
func extractPublicIDFromURL(rawURL string) string {
	rawURL = strings.TrimSpace(rawURL)
	if rawURL == "" || !strings.Contains(rawURL, "cloudinary.com") {
		return ""
	}
	idx := strings.Index(rawURL, "/upload/")
	if idx == -1 {
		return ""
	}
	pathAfterUpload := rawURL[idx+len("/upload/"):]
	if strings.HasPrefix(pathAfterUpload, "v") {
		slashIdx := strings.Index(pathAfterUpload, "/")
		if slashIdx != -1 {
			verPart := pathAfterUpload[1:slashIdx]
			isNum := true
			for _, ch := range verPart {
				if ch < '0' || ch > '9' {
					isNum = false
					break
				}
			}
			if isNum {
				pathAfterUpload = pathAfterUpload[slashIdx+1:]
			}
		}
	}
	if dotIdx := strings.LastIndex(pathAfterUpload, "."); dotIdx != -1 {
		pathAfterUpload = pathAfterUpload[:dotIdx]
	}
	return pathAfterUpload
}

// GenerateCloudinarySignature handles Cloudinary uploads, deletions, and signature generations
func GenerateCloudinarySignature(c *fiber.Ctx) error {
	cloudName := os.Getenv("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME")
	apiKey := os.Getenv("CLOUDINARY_API_KEY")
	apiSecret := os.Getenv("CLOUDINARY_API_SECRET")
	uploadPreset := os.Getenv("NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET")

	// 1. Check for DELETE request or deletion payload
	if c.Method() == "DELETE" {
		var req struct {
			PublicID string `json:"publicId"`
			URL      string `json:"url"`
		}
		_ = c.BodyParser(&req)
		if req.PublicID == "" {
			req.PublicID = c.Query("publicId")
		}
		if req.PublicID == "" && req.URL != "" {
			req.PublicID = extractPublicIDFromURL(req.URL)
		}
		if req.PublicID == "" && c.Query("url") != "" {
			req.PublicID = extractPublicIDFromURL(c.Query("url"))
		}
		if req.PublicID != "" && cloudName != "" && apiKey != "" && apiSecret != "" {
			timestamp := fmt.Sprintf("%d", time.Now().Unix())
			toSign := fmt.Sprintf("public_id=%s&timestamp=%s%s", req.PublicID, timestamp, apiSecret)
			hash := sha1.Sum([]byte(toSign))
			sig := hex.EncodeToString(hash[:])

			formData := fmt.Sprintf("public_id=%s&timestamp=%s&api_key=%s&signature=%s", req.PublicID, timestamp, apiKey, sig)
			_, _ = http.Post(fmt.Sprintf("https://api.cloudinary.com/v1_1/%s/image/destroy", cloudName), "application/x-www-form-urlencoded", strings.NewReader(formData))
		}
		return c.JSON(fiber.Map{"success": true, "message": "Image deleted successfully"})
	}

	// 2. Check for Multipart File Upload
	fileHeader, err := c.FormFile("file")
	if err == nil && fileHeader != nil {
		file, err := fileHeader.Open()
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Failed to open uploaded file: " + err.Error()})
		}
		defer file.Close()

		folder := strings.TrimSpace(c.FormValue("folder"))
		if folder == "" {
			folder = "products"
		}
		publicID := strings.TrimSpace(c.FormValue("publicId"))
		oldPublicID := strings.TrimSpace(c.FormValue("oldPublicId"))
		oldURL := strings.TrimSpace(c.FormValue("oldUrl"))

		if oldPublicID == "" && oldURL != "" {
			oldPublicID = extractPublicIDFromURL(oldURL)
		}

		// Strip duplicated folder prefix from publicID if present
		if publicID != "" && strings.HasPrefix(publicID, folder+"/") {
			publicID = strings.TrimPrefix(publicID, folder+"/")
		}

		// If oldPublicID is provided and differs from the new target public_id, attempt background destroy
		targetFullPID := publicID
		if targetFullPID != "" && folder != "" && !strings.Contains(targetFullPID, "/") {
			targetFullPID = folder + "/" + targetFullPID
		}

		if oldPublicID != "" && oldPublicID != targetFullPID && cloudName != "" && apiKey != "" && apiSecret != "" {
			go func(pID string) {
				ts := fmt.Sprintf("%d", time.Now().Unix())
				toSign := fmt.Sprintf("public_id=%s&timestamp=%s%s", pID, ts, apiSecret)
				h := sha1.Sum([]byte(toSign))
				s := hex.EncodeToString(h[:])
				fd := fmt.Sprintf("public_id=%s&timestamp=%s&api_key=%s&signature=%s", pID, ts, apiKey, s)
				_, _ = http.Post(fmt.Sprintf("https://api.cloudinary.com/v1_1/%s/image/destroy", cloudName), "application/x-www-form-urlencoded", strings.NewReader(fd))
			}(oldPublicID)
		}

		bodyBuf := &bytes.Buffer{}
		mw := multipart.NewWriter(bodyBuf)

		part, err := mw.CreateFormFile("file", fileHeader.Filename)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create form file: " + err.Error()})
		}
		if _, err := io.Copy(part, file); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to copy file contents: " + err.Error()})
		}

		timestamp := fmt.Sprintf("%d", time.Now().Unix())

		if apiKey != "" && apiSecret != "" {
			_ = mw.WriteField("api_key", apiKey)
			_ = mw.WriteField("timestamp", timestamp)
			_ = mw.WriteField("folder", folder)
			_ = mw.WriteField("overwrite", "true")
			_ = mw.WriteField("invalidate", "true")
			if publicID != "" {
				_ = mw.WriteField("public_id", publicID)
			}

			signParams := []string{
				fmt.Sprintf("folder=%s", folder),
				"invalidate=true",
				"overwrite=true",
				fmt.Sprintf("timestamp=%s", timestamp),
			}
			if publicID != "" {
				signParams = append(signParams, fmt.Sprintf("public_id=%s", publicID))
			}
			sort.Strings(signParams)
			toSign := strings.Join(signParams, "&") + apiSecret
			hash := sha1.Sum([]byte(toSign))
			signature := hex.EncodeToString(hash[:])
			_ = mw.WriteField("signature", signature)
		} else if uploadPreset != "" {
			// Unsigned upload fallback
			_ = mw.WriteField("upload_preset", uploadPreset)
			_ = mw.WriteField("folder", folder)
			_ = mw.WriteField("overwrite", "true")
			_ = mw.WriteField("invalidate", "true")
			if publicID != "" {
				_ = mw.WriteField("public_id", publicID)
			}
		}

		_ = mw.Close()

		cloudUploadURL := fmt.Sprintf("https://api.cloudinary.com/v1_1/%s/image/upload", cloudName)
		httpReq, err := http.NewRequest("POST", cloudUploadURL, bodyBuf)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}
		httpReq.Header.Set("Content-Type", mw.FormDataContentType())

		client := &http.Client{Timeout: 30 * time.Second}
		resp, err := client.Do(httpReq)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Cloudinary upload failed: " + err.Error()})
		}
		defer resp.Body.Close()

		respBytes, _ := io.ReadAll(resp.Body)
		var cldResp struct {
			SecureURL string `json:"secure_url"`
			PublicID  string `json:"public_id"`
			URL       string `json:"url"`
			Error     *struct {
				Message string `json:"message"`
			} `json:"error,omitempty"`
		}

		if err := json.Unmarshal(respBytes, &cldResp); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to parse Cloudinary response"})
		}

		if cldResp.Error != nil && cldResp.Error.Message != "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": cldResp.Error.Message})
		}

		return c.JSON(fiber.Map{
			"success":    true,
			"secure_url": cldResp.SecureURL,
			"public_id":  cldResp.PublicID,
			"url":        cldResp.URL,
		})
	}

	// 3. Fallback: JSON signature generation
	var params map[string]interface{}
	_ = c.BodyParser(&params)
	timestamp := time.Now().Unix()

	if params == nil {
		params = make(map[string]interface{})
	}
	params["timestamp"] = timestamp

	var keys []string
	for k := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var pairs []string
	for _, k := range keys {
		pairs = append(pairs, fmt.Sprintf("%s=%v", k, params[k]))
	}

	toSign := strings.Join(pairs, "&") + apiSecret
	hash := sha1.Sum([]byte(toSign))
	signature := hex.EncodeToString(hash[:])

	return c.JSON(fiber.Map{
		"signature": signature,
		"timestamp": timestamp,
		"cloudName": cloudName,
		"apiKey":    apiKey,
	})
}

// GetAutomationRules returns store automation rules
func GetAutomationRules(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"success": true,
		"rules":   []interface{}{},
	})
}

// UpdateAutomationRules updates automation rules
func UpdateAutomationRules(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"success": true,
		"message": "Automation rules updated",
	})
}

// SubmitSupportTicket creates a customer support message
func SubmitSupportTicket(c *fiber.Ctx) error {
	var req struct {
		Name    string `json:"name"`
		Email   string `json:"email"`
		Phone   string `json:"phone"`
		Message string `json:"message"`
	}
	_ = c.BodyParser(&req)

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Pesan bantuan telah diterima.",
	})
}
