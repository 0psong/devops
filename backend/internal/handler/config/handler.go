package config

import (
	"strconv"

	"devops/internal/middleware"
	"devops/internal/pkg/response"
	"devops/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	configService *service.ConfigService
}

func NewHandler(configService *service.ConfigService) *Handler {
	return &Handler{configService: configService}
}

func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	configs := r.Group("/configs")
	{
		configs.GET("", h.ListConfigs)
		configs.POST("", h.CreateConfig)
		configs.GET("/fetch", h.FetchConfigs) // Static route before dynamic /:id
		configs.GET("/:id", h.GetConfig)
		configs.PUT("/:id", h.UpdateConfig)
		configs.DELETE("/:id", h.DeleteConfig)
		configs.GET("/:id/history", h.GetConfigHistory)
	}
}

func (h *Handler) ListConfigs(c *gin.Context) {
	page := getIntParam(c, "page", 1)
	pageSize := getIntParam(c, "page_size", 20)
	envCode := c.Query("env_code")
	appCode := c.Query("app_code")
	keyword := c.Query("keyword")

	configs, total, err := h.configService.List(page, pageSize, envCode, appCode, keyword)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.SuccessPage(c, configs, total, page, pageSize)
}

func (h *Handler) CreateConfig(c *gin.Context) {
	var req service.CreateConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	claims := middleware.GetCurrentUser(c)
	config, err := h.configService.Create(&req, claims.UserID, claims.Username)
	if err != nil {
		if err == service.ErrConfigKeyExists {
			response.Error(c, 4001, "配置键已存在")
			return
		}
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, config)
}

func (h *Handler) GetConfig(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	// Check if should decrypt
	decrypt := c.Query("decrypt") == "true"

	config, err := h.configService.GetByID(id, decrypt)
	if err != nil {
		response.NotFound(c, "配置项不存在")
		return
	}

	response.Success(c, config)
}

func (h *Handler) UpdateConfig(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	var req service.UpdateConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	claims := middleware.GetCurrentUser(c)
	config, err := h.configService.Update(id, &req, claims.UserID, claims.Username)
	if err != nil {
		if err == service.ErrConfigNotFound {
			response.NotFound(c, "配置项不存在")
			return
		}
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, config)
}

func (h *Handler) DeleteConfig(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	claims := middleware.GetCurrentUser(c)
	if err := h.configService.Delete(id, claims.UserID, claims.Username); err != nil {
		if err == service.ErrConfigNotFound {
			response.NotFound(c, "配置项不存在")
			return
		}
		response.ServerError(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "删除成功", nil)
}

func (h *Handler) GetConfigHistory(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	limit := getIntParam(c, "limit", 20)
	histories, err := h.configService.GetHistory(id, limit)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, histories)
}

func (h *Handler) FetchConfigs(c *gin.Context) {
	envCode := c.Query("env_code")
	appCode := c.Query("app_code")

	if envCode == "" {
		response.BadRequest(c, "需要提供env_code")
		return
	}

	configs, err := h.configService.GetByEnvAndApp(envCode, appCode, true)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	// Convert to key-value map
	result := make(map[string]string)
	for _, cfg := range configs {
		result[cfg.Key] = cfg.Value
	}

	response.Success(c, result)
}

// Helper
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
