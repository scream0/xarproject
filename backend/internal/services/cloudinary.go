package services

import (
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

// ExtractPublicIDFromURL extracts Cloudinary public_id from a full URL
func ExtractPublicIDFromURL(rawURL string) string {
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

// DeleteCloudinaryImage deletes an image asset from Cloudinary by its public ID or full URL
func DeleteCloudinaryImage(urlOrPublicID string) error {
	urlOrPublicID = strings.TrimSpace(urlOrPublicID)
	if urlOrPublicID == "" {
		return nil
	}

	publicID := urlOrPublicID
	if strings.Contains(urlOrPublicID, "http") || strings.Contains(urlOrPublicID, "cloudinary.com") {
		publicID = ExtractPublicIDFromURL(urlOrPublicID)
	}

	if publicID == "" {
		return nil
	}

	cloudName := os.Getenv("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME")
	apiKey := os.Getenv("CLOUDINARY_API_KEY")
	apiSecret := os.Getenv("CLOUDINARY_API_SECRET")

	if cloudName == "" || apiKey == "" || apiSecret == "" {
		log.Printf("[Cloudinary] Skip delete for '%s': missing credentials", publicID)
		return nil
	}

	timestamp := fmt.Sprintf("%d", time.Now().Unix())
	toSign := fmt.Sprintf("public_id=%s&timestamp=%s%s", publicID, timestamp, apiSecret)
	hash := sha1.Sum([]byte(toSign))
	sig := hex.EncodeToString(hash[:])

	formData := fmt.Sprintf("public_id=%s&timestamp=%s&api_key=%s&signature=%s", publicID, timestamp, apiKey, sig)
	resp, err := http.Post(
		fmt.Sprintf("https://api.cloudinary.com/v1_1/%s/image/destroy", cloudName),
		"application/x-www-form-urlencoded",
		strings.NewReader(formData),
	)
	if err != nil {
		log.Printf("[Cloudinary Error] Failed to destroy image %s: %v", publicID, err)
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode == 200 {
		log.Printf("🗑️ [Cloudinary] Successfully deleted image: %s", publicID)
	}
	return nil
}
