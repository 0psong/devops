package dashboard

import (
	"strconv"

	"devops/internal/pkg/response"
	"devops/internal/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	dashboardService *service.DashboardService
}

func NewHandler(dashboardService *service.DashboardService) *Handler {
	return &Handler{dashboardService: dashboardService}
}

func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	dashboard := r.Group("/dashboard")
	{
		dashboard.GET("/stats", h.GetStats)
		dashboard.GET("/activities", h.GetActivities)
		dashboard.GET("/deploy-trend", h.GetDeployTrend)
	}
}

func (h *Handler) GetStats(c *gin.Context) {
	stats, err := h.dashboardService.GetStats()
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, stats)
}

func (h *Handler) GetActivities(c *gin.Context) {
	limit := getIntParam(c, "limit", 10)

	activities, err := h.dashboardService.GetRecentActivities(limit)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, activities)
}

func (h *Handler) GetDeployTrend(c *gin.Context) {
	days := getIntParam(c, "days", 7)

	trend, err := h.dashboardService.GetDeployTrend(days)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, trend)
}

func getIntParam(c *gin.Context, key string, defaultVal int) int {
	val := c.Query(key)
	if val == "" {
		return defaultVal
	}
	if n, err := strconv.Atoi(val); err == nil {
		return n
	}
	return defaultVal
}
