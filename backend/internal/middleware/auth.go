package middleware

import (
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"net/url"
	"strings"
	"xar-backend-go/internal/config"

	"github.com/gofiber/fiber/v2"
)

type AuthUser struct {
	ID    string `json:"sub"`
	Email string `json:"email"`
	Role  string `json:"role"`
}

type JWTClaims struct {
	Sub          string                 `json:"sub"`
	Email        string                 `json:"email"`
	UserMetadata map[string]interface{} `json:"user_metadata"`
	Role         string                 `json:"role"`
}

// ExtractTokenFromCtx retrieves the auth token from Bearer header or browser cookies
func ExtractTokenFromCtx(c *fiber.Ctx) string {
	authHeader := c.Get("Authorization")
	if authHeader != "" {
		parts := strings.Split(authHeader, " ")
		if len(parts) == 2 && strings.EqualFold(parts[0], "bearer") {
			return parts[1]
		}
		if len(parts) == 1 && !strings.EqualFold(parts[0], "bearer") {
			return parts[0]
		}
	}

	// Check common cookies
	if token := c.Cookies("sb-access-token"); token != "" {
		return token
	}
	if token := c.Cookies("session"); token != "" {
		return token
	}

	// Check Supabase project auth cookies (format: base64-encoded json containing access_token)
	cookieHeader := c.Get("Cookie")
	if cookieHeader != "" {
		cookieParts := strings.Split(cookieHeader, ";")
		for _, cp := range cookieParts {
			kv := strings.SplitN(strings.TrimSpace(cp), "=", 2)
			if len(kv) == 2 {
				name := kv[0]
				val := kv[1]
				if strings.HasPrefix(name, "sb-") && strings.HasSuffix(name, "-auth-token") {
					// Supabase auth token cookie may be URI encoded or base64
					if decoded, err := url.QueryUnescape(val); err == nil {
						val = decoded
					}
					var cookieSession struct {
						AccessToken string `json:"access_token"`
					}
					if err := json.Unmarshal([]byte(val), &cookieSession); err == nil && cookieSession.AccessToken != "" {
						return cookieSession.AccessToken
					}
					// Or it might be a direct JWT
					if strings.Count(val, ".") == 2 {
						return val
					}
				}
			}
		}
	}

	return ""
}

// ParseSupabaseToken decodes the payload of a Supabase JWT and checks profile role from PostgreSQL
func ParseSupabaseToken(tokenOrHeader string) (*AuthUser, error) {
	tokenString := strings.TrimSpace(tokenOrHeader)
	if tokenString == "" {
		return nil, fiber.NewError(fiber.StatusUnauthorized, "No authorization token provided")
	}

	parts := strings.Split(tokenString, " ")
	if len(parts) == 2 && strings.EqualFold(parts[0], "bearer") {
		tokenString = parts[1]
	}

	jwtSegments := strings.Split(tokenString, ".")
	if len(jwtSegments) < 2 {
		return nil, fiber.NewError(fiber.StatusUnauthorized, "Malformed JWT token")
	}

	payloadBytes, err := base64.RawURLEncoding.DecodeString(jwtSegments[1])
	if err != nil {
		payloadBytes, err = base64.StdEncoding.DecodeString(jwtSegments[1])
		if err != nil {
			return nil, fiber.NewError(fiber.StatusUnauthorized, "Failed to decode JWT payload")
		}
	}

	var claims JWTClaims
	if err := json.Unmarshal(payloadBytes, &claims); err != nil {
		return nil, fiber.NewError(fiber.StatusUnauthorized, "Failed to parse JWT claims")
	}

	fallbackRole := "user"
	if roleVal, ok := claims.UserMetadata["role"].(string); ok && roleVal != "" {
		fallbackRole = strings.ToLower(strings.TrimSpace(roleVal))
	}

	authUser := &AuthUser{
		ID:    claims.Sub,
		Email: claims.Email,
		Role:  fallbackRole,
	}

	// Fetch true role from profiles table via raw SQL if database is initialized
	if config.DB != nil && authUser.ID != "" {
		var dbRole sql.NullString
		err := config.DB.QueryRow("SELECT role FROM profiles WHERE id::text = $1 LIMIT 1", authUser.ID).Scan(&dbRole)
		if err == nil && dbRole.Valid {
			authUser.Role = strings.ToLower(strings.TrimSpace(dbRole.String))
		}
	}

	return authUser, nil
}

// RequireAuth middleware verifies that the requester has a valid session token
func RequireAuth() fiber.Handler {
	return func(c *fiber.Ctx) error {
		token := ExtractTokenFromCtx(c)
		user, err := ParseSupabaseToken(token)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": err.Error(),
			})
		}

		c.Locals("user", user)
		return c.Next()
	}
}

// RequireAdmin middleware ensures the requester is an admin or superadmin
func RequireAdmin() fiber.Handler {
	return func(c *fiber.Ctx) error {
		token := ExtractTokenFromCtx(c)
		user, err := ParseSupabaseToken(token)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": err.Error(),
			})
		}

		if user.Role != "admin" && user.Role != "superadmin" {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "User is not an administrator",
			})
		}

		c.Locals("user", user)
		return c.Next()
	}
}
