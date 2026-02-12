package middleware

import (
	"github.com/gin-gonic/gin"
)

// SecurityHeaders adds security-related HTTP headers to all responses.
func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Prevent MIME type sniffing
		c.Header("X-Content-Type-Options", "nosniff")
		// Prevent clickjacking
		c.Header("X-Frame-Options", "DENY")
		// Enable XSS protection
		c.Header("X-XSS-Protection", "1; mode=block")
		// Control referrer information
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		// Permissions policy
		c.Header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		// HSTS (browsers should only connect via HTTPS)
		// Uncomment when HTTPS is enabled:
		// c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")

		c.Next()
	}
}
