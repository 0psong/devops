package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type rateLimiter struct {
	mu       sync.Mutex
	visitors map[string]*visitor
	rate     int           // max requests
	window   time.Duration // time window
}

type visitor struct {
	count    int
	windowAt time.Time
}

// RateLimit returns a middleware that limits requests per IP address.
// maxRequests is the maximum number of requests allowed within the time window.
func RateLimit(maxRequests int, window time.Duration) gin.HandlerFunc {
	rl := &rateLimiter{
		visitors: make(map[string]*visitor),
		rate:     maxRequests,
		window:   window,
	}

	// Cleanup expired entries every minute
	go func() {
		for {
			time.Sleep(time.Minute)
			rl.cleanup()
		}
	}()

	return func(c *gin.Context) {
		ip := c.ClientIP()
		if !rl.allow(ip) {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"code":    429,
				"message": "too many requests, please try again later",
			})
			c.Abort()
			return
		}
		c.Next()
	}
}

func (rl *rateLimiter) allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	v, exists := rl.visitors[ip]
	if !exists || now.Sub(v.windowAt) > rl.window {
		rl.visitors[ip] = &visitor{count: 1, windowAt: now}
		return true
	}

	v.count++
	return v.count <= rl.rate
}

func (rl *rateLimiter) cleanup() {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	for ip, v := range rl.visitors {
		if now.Sub(v.windowAt) > rl.window {
			delete(rl.visitors, ip)
		}
	}
}
