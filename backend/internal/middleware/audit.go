package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log"
	"strings"
	"time"

	"devops/internal/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type bodyLogWriter struct {
	gin.ResponseWriter
	body *bytes.Buffer
}

func (w bodyLogWriter) Write(b []byte) (int, error) {
	w.body.Write(b)
	return w.ResponseWriter.Write(b)
}

func AuditLog(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip GET requests
		if c.Request.Method == "GET" {
			c.Next()
			return
		}

		// Read request body (limit to 1MB to prevent memory exhaustion)
		var requestBody []byte
		if c.Request.Body != nil {
			limited := io.LimitReader(c.Request.Body, 1<<20) // 1MB max
			requestBody, _ = io.ReadAll(limited)
			c.Request.Body = io.NopCloser(bytes.NewBuffer(requestBody))
		}

		// Capture response
		blw := &bodyLogWriter{body: bytes.NewBufferString(""), ResponseWriter: c.Writer}
		c.Writer = blw

		startTime := time.Now()
		c.Next()

		// Get user info
		user := GetCurrentUser(c)
		var userID uuid.UUID
		var username string
		if user != nil {
			userID = user.UserID
			username = user.Username
		}

		// Determine action from method and path
		action := getAction(c.Request.Method, c.FullPath())

		// Determine status
		status := 1
		if c.Writer.Status() >= 400 {
			status = 0
		}

		// Create audit log with sanitized body
		auditLog := &model.AuditLog{
			UserID:     userID,
			Username:   username,
			Action:     action,
			Resource:   c.FullPath(),
			ResourceID: c.Param("id"),
			Detail:     sanitizeBody(requestBody),
			IP:         c.ClientIP(),
			UserAgent:  c.Request.UserAgent(),
			Status:     status,
			CreatedAt:  startTime,
		}

		// Async save to database with timeout to prevent goroutine leaks
		go func(auditEntry *model.AuditLog) {
			defer func() {
				if r := recover(); r != nil {
					log.Printf("Panic in audit log goroutine: %v", r)
				}
			}()
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			if err := db.WithContext(ctx).Create(auditEntry).Error; err != nil {
				log.Printf("Failed to save audit log: %v", err)
			}
		}(auditLog)
	}
}

func getAction(method, path string) string {
	switch method {
	case "POST":
		return "create"
	case "PUT", "PATCH":
		return "update"
	case "DELETE":
		return "delete"
	default:
		return method
	}
}

// sanitizeBody removes sensitive fields from the request body before storing in audit log
func sanitizeBody(body []byte) string {
	if len(body) == 0 {
		return ""
	}

	var data map[string]interface{}
	if err := json.Unmarshal(body, &data); err != nil {
		return "[non-json body]"
	}

	sensitiveFields := []string{
		"password", "old_password", "new_password",
		"private_key", "kubeconfig", "token", "secret",
		"kube_config",
	}

	for key := range data {
		lower := strings.ToLower(key)
		for _, sf := range sensitiveFields {
			if lower == sf || strings.Contains(lower, sf) {
				data[key] = "[REDACTED]"
				break
			}
		}
	}

	sanitized, err := json.Marshal(data)
	if err != nil {
		return "[marshal error]"
	}
	return string(sanitized)
}
