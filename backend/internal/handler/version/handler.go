package version

import (
	"strconv"

	"devops/internal/middleware"
	"devops/internal/pkg/response"
	"devops/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	versionService *service.VersionService
}

func NewHandler(versionService *service.VersionService) *Handler {
	return &Handler{
		versionService: versionService,
	}
}

func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	versions := r.Group("/versions")
	{
		versions.GET("", h.ListVersions)
		versions.POST("", h.CreateVersion)
		versions.GET("/:id", h.GetVersion)
		versions.PUT("/:id", h.UpdateVersion)
		versions.DELETE("/:id", h.DeleteVersion)
		versions.POST("/:id/deploy", h.DeployVersion)
		versions.POST("/:id/rollback", h.RollbackToVersion)
	}
}

func (h *Handler) ListVersions(c *gin.Context) {
	page := getIntParam(c, "page", 1)
	pageSize := getIntParam(c, "page_size", 20)
	keyword := c.Query("keyword")

	var appID *uuid.UUID
	if aid := c.Query("app_id"); aid != "" {
		if id, err := uuid.Parse(aid); err == nil {
			appID = &id
		}
	}

	versions, total, err := h.versionService.List(page, pageSize, appID, keyword)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.SuccessPage(c, versions, total, page, pageSize)
}

func (h *Handler) CreateVersion(c *gin.Context) {
	var req service.CreateVersionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	claims := middleware.GetCurrentUser(c)
	if claims == nil {
		response.Error(c, 4010, "未登录")
		return
	}

	version, err := h.versionService.Create(&req, claims.UserID)
	if err != nil {
		if err == service.ErrAppNotFound {
			response.NotFound(c, "应用不存在")
			return
		}
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, version)
}

func (h *Handler) GetVersion(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	version, err := h.versionService.GetByID(id)
	if err != nil {
		response.NotFound(c, "版本不存在")
		return
	}

	response.Success(c, version)
}

func (h *Handler) UpdateVersion(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	var req service.UpdateVersionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	version, err := h.versionService.Update(id, &req)
	if err != nil {
		if err == service.ErrVersionNotFound {
			response.NotFound(c, "版本不存在")
			return
		}
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, version)
}

func (h *Handler) DeleteVersion(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	if err := h.versionService.Delete(id); err != nil {
		if err == service.ErrVersionNotFound {
			response.NotFound(c, "版本不存在")
			return
		}
		response.ServerError(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "删除成功", nil)
}

func (h *Handler) DeployVersion(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	claims := middleware.GetCurrentUser(c)
	if claims == nil {
		response.Error(c, 4010, "未登录")
		return
	}

	version, err := h.versionService.Deploy(id)
	if err != nil {
		if err == service.ErrVersionNotFound {
			response.NotFound(c, "版本不存在")
			return
		}
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, version)
}

func (h *Handler) RollbackToVersion(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	claims := middleware.GetCurrentUser(c)
	if claims == nil {
		response.Error(c, 4010, "未登录")
		return
	}

	version, err := h.versionService.SetCurrent(id)
	if err != nil {
		if err == service.ErrVersionNotFound {
			response.NotFound(c, "版本不存在")
			return
		}
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, version)
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
