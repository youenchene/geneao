// Package auth provides shared-password authentication with JWT tokens.
package auth

import (
	"crypto/subtle"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
)

// Service handles authentication logic.
type Service struct {
	sharedPassword string
	jwtSecret      []byte
}

// NewService creates a new auth service.
func NewService(sharedPassword, jwtSecret string) *Service {
	return &Service{
		sharedPassword: sharedPassword,
		jwtSecret:      []byte(jwtSecret),
	}
}

// ValidatePassword checks if the provided password matches using constant-time
// comparison to prevent timing attacks.
func (s *Service) ValidatePassword(password string) bool {
	return subtle.ConstantTimeCompare([]byte(password), []byte(s.sharedPassword)) == 1
}

// GenerateToken creates a signed JWT token valid for 24 hours.
func (s *Service) GenerateToken() (string, error) {
	claims := jwt.MapClaims{
		"iat": time.Now().Unix(),
		"exp": time.Now().Add(24 * time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.jwtSecret)
}

// Middleware returns an Echo middleware that validates JWT tokens.
// Checks both the Authorization header (Bearer token) and the HttpOnly cookie.
func Middleware(jwtSecret string) echo.MiddlewareFunc {
	secret := []byte(jwtSecret)
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			var tokenStr string

			// Try Authorization header first
			authHeader := c.Request().Header.Get("Authorization")
			if authHeader != "" {
				parts := strings.SplitN(authHeader, " ", 2)
				if len(parts) == 2 && strings.ToLower(parts[0]) == "bearer" {
					tokenStr = parts[1]
				}
			}

			// Fall back to HttpOnly cookie
			if tokenStr == "" {
				cookie, err := c.Cookie("geneao_token")
				if err == nil && cookie.Value != "" {
					tokenStr = cookie.Value
				}
			}

			if tokenStr == "" {
				return c.JSON(http.StatusUnauthorized, map[string]string{"error": "missing authentication"})
			}

			token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
				if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, echo.NewHTTPError(http.StatusUnauthorized, "unexpected signing method")
				}
				return secret, nil
			})
			if err != nil || !token.Valid {
				return c.JSON(http.StatusUnauthorized, map[string]string{"error": "invalid or expired token"})
			}

			return next(c)
		}
	}
}
