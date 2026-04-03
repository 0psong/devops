package pipeline

import (
	"strconv"

	"devops/internal/middleware"
	"devops/internal/pkg/response"
	"devops/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	pipelineService *service.PipelineService
}

func NewHandler(pipelineService *service.PipelineService) *Handler {
	return &Handler{pipelineService: pipelineService}
}

func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	pipelines := r.Group("/pipelines")
	{
		pipelines.GET("", h.List)
		pipelines.POST("", h.Create)
		pipelines.GET("/:id", h.Get)
		pipelines.DELETE("/:id", h.Delete)
		pipelines.POST("/:id/run", h.Run)
		pipelines.POST("/:id/cancel", h.Cancel)
	}
}

func (h *Handler) List(c *gin.Context) {
	page := getIntParam(c, "page", 1)
	pageSize := getIntParam(c, "page_size", 20)
	status := c.Query("status")

	var appID *uuid.UUID
	if aid := c.Query("app_id"); aid != "" {
		if id, err := uuid.Parse(aid); err == nil {
			appID = &id
		}
	}

	pipelines, total, err := h.pipelineService.List(page, pageSize, appID, status)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.SuccessPage(c, pipelines, total, page, pageSize)
}

func (h *Handler) Create(c *gin.Context) {
	var req service.CreatePipelineRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	claims := middleware.GetCurrentUser(c)
	if claims == nil {
		response.Error(c, 4010, "未登录")
		return
	}

	pipeline, err := h.pipelineService.Create(&req, claims.UserID)
	if err != nil {
		if err == service.ErrAppNotFound {
			response.NotFound(c, "应用不存在")
			return
		}
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, pipeline)
}

func (h *Handler) Get(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	pipeline, err := h.pipelineService.GetByID(id)
	if err != nil {
		response.NotFound(c, "流水线不存在")
		return
	}

	response.Success(c, pipeline)
}

func (h *Handler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	if err := h.pipelineService.Delete(id); err != nil {
		if err == service.ErrPipelineNotFound {
			response.NotFound(c, "流水线不存在")
			return
		}
		response.ServerError(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "删除成功", nil)
}

func (h *Handler) Run(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	pipeline, err := h.pipelineService.Run(id)
	if err != nil {
		if err == service.ErrPipelineNotFound {
			response.NotFound(c, "流水线不存在")
			return
		}
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, pipeline)
}

func (h *Handler) Cancel(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	pipeline, err := h.pipelineService.Cancel(id)
	if err != nil {
		if err == service.ErrPipelineNotFound {
			response.NotFound(c, "流水线不存在")
			return
		}
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, pipeline)
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
