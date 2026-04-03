package deploy

import (
	"strconv"

	"devops/internal/middleware"
	"devops/internal/pkg/response"
	"devops/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	appService    *service.AppService
	deployService *service.DeploymentService
	envService    *service.EnvService
}

func NewHandler(
	appService *service.AppService,
	deployService *service.DeploymentService,
	envService *service.EnvService,
) *Handler {
	return &Handler{
		appService:    appService,
		deployService: deployService,
		envService:    envService,
	}
}

func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	apps := r.Group("/apps")
	{
		apps.GET("", h.ListApps)
		apps.POST("", h.CreateApp)
		apps.GET("/:id", h.GetApp)
		apps.PUT("/:id", h.UpdateApp)
		apps.DELETE("/:id", h.DeleteApp)
	}

	deploys := r.Group("/deployments")
	{
		deploys.GET("", h.ListDeployments)
		deploys.POST("", h.CreateDeployment)
		deploys.GET("/:id", h.GetDeployment)
		deploys.POST("/:id/start", h.StartDeployment)
		deploys.POST("/rollback", h.Rollback)
	}

	envs := r.Group("/environments")
	{
		envs.GET("", h.ListEnvironments)
	}
}

// App handlers
func (h *Handler) ListApps(c *gin.Context) {
	page := getIntParam(c, "page", 1)
	pageSize := getIntParam(c, "page_size", 20)
	keyword := c.Query("keyword")

	var envID *uuid.UUID
	if eid := c.Query("env_id"); eid != "" {
		if id, err := uuid.Parse(eid); err == nil {
			envID = &id
		}
	}

	apps, total, err := h.appService.List(page, pageSize, envID, keyword)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.SuccessPage(c, apps, total, page, pageSize)
}

func (h *Handler) CreateApp(c *gin.Context) {
	var req service.CreateAppRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	claims := middleware.GetCurrentUser(c)
	app, err := h.appService.Create(&req, claims.UserID)
	if err != nil {
		if err == service.ErrAppCodeExists {
			response.Error(c, 3001, "应用代码已存在")
			return
		}
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, app)
}

func (h *Handler) GetApp(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	app, err := h.appService.GetByID(id)
	if err != nil {
		response.NotFound(c, "应用不存在")
		return
	}

	response.Success(c, app)
}

func (h *Handler) UpdateApp(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	var req service.UpdateAppRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	app, err := h.appService.Update(id, &req)
	if err != nil {
		if err == service.ErrAppNotFound {
			response.NotFound(c, "应用不存在")
			return
		}
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, app)
}

func (h *Handler) DeleteApp(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	if err := h.appService.Delete(id); err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "删除成功", nil)
}

// Deployment handlers
func (h *Handler) ListDeployments(c *gin.Context) {
	appID, err := uuid.Parse(c.Query("app_id"))
	if err != nil {
		response.BadRequest(c, "需要提供app_id")
		return
	}

	page := getIntParam(c, "page", 1)
	pageSize := getIntParam(c, "page_size", 20)

	deployments, total, err := h.deployService.List(appID, page, pageSize)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.SuccessPage(c, deployments, total, page, pageSize)
}

func (h *Handler) CreateDeployment(c *gin.Context) {
	var req service.CreateDeployRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	claims := middleware.GetCurrentUser(c)
	deployment, err := h.deployService.Create(&req, claims.UserID)
	if err != nil {
		if err == service.ErrAppNotFound {
			response.NotFound(c, "应用不存在")
			return
		}
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, deployment)
}

func (h *Handler) GetDeployment(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	deployment, err := h.deployService.GetByID(id)
	if err != nil {
		response.NotFound(c, "部署记录不存在")
		return
	}

	response.Success(c, deployment)
}

func (h *Handler) StartDeployment(c *gin.Context) {
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

	if err := h.deployService.StartDeploy(id); err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "部署已启动", nil)
}

func (h *Handler) Rollback(c *gin.Context) {
	var req struct {
		AppID          uuid.UUID `json:"app_id" binding:"required"`
		TargetDeployID uuid.UUID `json:"target_deploy_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	claims := middleware.GetCurrentUser(c)
	if claims == nil {
		response.Error(c, 4010, "未登录")
		return
	}
	deployment, err := h.deployService.Rollback(req.AppID, req.TargetDeployID, claims.UserID)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, deployment)
}

// Environment handlers
func (h *Handler) ListEnvironments(c *gin.Context) {
	envs, err := h.envService.List()
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, envs)
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
