package pipeline_v2

import (
	"strconv"

	"devops/internal/middleware"
	"devops/internal/pkg/response"
	"devops/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	pipelineV2Service *service.PipelineV2Service
}

func NewHandler(pipelineV2Service *service.PipelineV2Service) *Handler {
	return &Handler{pipelineV2Service: pipelineV2Service}
}

func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	// 流水线定义
	defs := r.Group("/pipeline-defs")
	{
		defs.GET("", h.ListDefinitions)
		defs.POST("", h.CreateDefinition)
		defs.GET("/:id", h.GetDefinition)
		defs.PUT("/:id", h.UpdateDefinition)
		defs.DELETE("/:id", h.DeleteDefinition)
		defs.POST("/:id/trigger", h.TriggerRun)
	}

	// 流水线运行
	runs := r.Group("/pipeline-runs")
	{
		runs.GET("", h.ListRuns)
		runs.GET("/:id", h.GetRun)
		runs.POST("/:id/cancel", h.CancelRun)
		runs.POST("/:id/retry", h.RetryRun)
		runs.GET("/:id/stages", h.GetStages)
		runs.GET("/:id/steps/:stepId/log", h.GetStepLog)
		runs.POST("/:id/approve", h.ApproveRun)
		runs.POST("/:id/reject", h.RejectRun)
	}

	// 待审批
	approvals := r.Group("/approvals")
	{
		approvals.GET("/pending", h.ListPendingApprovals)
	}

	// 制品
	artifacts := r.Group("/artifacts")
	{
		artifacts.GET("", h.ListArtifacts)
		artifacts.POST("", h.CreateArtifact)
		artifacts.GET("/:id", h.GetArtifact)
		artifacts.DELETE("/:id", h.DeleteArtifact)
	}
}

// --- 定义 ---

func (h *Handler) ListDefinitions(c *gin.Context) {
	page := getIntParam(c, "page", 1)
	pageSize := getIntParam(c, "page_size", 20)
	keyword := c.Query("keyword")

	var appID *uuid.UUID
	if aid := c.Query("app_id"); aid != "" {
		if id, err := uuid.Parse(aid); err == nil {
			appID = &id
		}
	}

	defs, total, err := h.pipelineV2Service.ListDefinitions(page, pageSize, appID, keyword)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.SuccessPage(c, defs, total, page, pageSize)
}

func (h *Handler) CreateDefinition(c *gin.Context) {
	var req service.CreateDefinitionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	claims := middleware.GetCurrentUser(c)
	if claims == nil {
		response.Error(c, 4010, "未登录")
		return
	}

	def, err := h.pipelineV2Service.CreateDefinition(&req, claims.UserID)
	if err != nil {
		if err == service.ErrAppNotFound {
			response.NotFound(c, "应用不存在")
			return
		}
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, def)
}

func (h *Handler) GetDefinition(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	def, err := h.pipelineV2Service.GetDefinition(id)
	if err != nil {
		response.NotFound(c, "流水线定义不存在")
		return
	}

	response.Success(c, def)
}

func (h *Handler) UpdateDefinition(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	var req service.UpdateDefinitionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	def, err := h.pipelineV2Service.UpdateDefinition(id, &req)
	if err != nil {
		if err == service.ErrPipelineDefNotFound {
			response.NotFound(c, "流水线定义不存在")
			return
		}
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, def)
}

func (h *Handler) DeleteDefinition(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	if err := h.pipelineV2Service.DeleteDefinition(id); err != nil {
		if err == service.ErrPipelineDefNotFound {
			response.NotFound(c, "流水线定义不存在")
			return
		}
		response.ServerError(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "删除成功", nil)
}

func (h *Handler) TriggerRun(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	var req service.TriggerRunRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	claims := middleware.GetCurrentUser(c)
	if claims == nil {
		response.Error(c, 4010, "未登录")
		return
	}

	run, err := h.pipelineV2Service.TriggerRun(id, &req, claims.UserID)
	if err != nil {
		if err == service.ErrPipelineDefNotFound {
			response.NotFound(c, "流水线定义不存在")
			return
		}
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, run)
}

// --- 运行记录 ---

func (h *Handler) ListRuns(c *gin.Context) {
	page := getIntParam(c, "page", 1)
	pageSize := getIntParam(c, "page_size", 20)
	status := c.Query("status")

	var defID *uuid.UUID
	if did := c.Query("definition_id"); did != "" {
		if id, err := uuid.Parse(did); err == nil {
			defID = &id
		}
	}

	runs, total, err := h.pipelineV2Service.ListRuns(page, pageSize, defID, status)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.SuccessPage(c, runs, total, page, pageSize)
}

func (h *Handler) GetRun(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	run, err := h.pipelineV2Service.GetRun(id)
	if err != nil {
		response.NotFound(c, "运行记录不存在")
		return
	}

	response.Success(c, run)
}

func (h *Handler) CancelRun(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	run, err := h.pipelineV2Service.CancelRun(id)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, run)
}

func (h *Handler) RetryRun(c *gin.Context) {
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

	run, err := h.pipelineV2Service.RetryRun(id, claims.UserID)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, run)
}

func (h *Handler) GetStages(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	stages, err := h.pipelineV2Service.GetStages(id)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, stages)
}

func (h *Handler) GetStepLog(c *gin.Context) {
	stepID, err := uuid.Parse(c.Param("stepId"))
	if err != nil {
		response.BadRequest(c, "无效的步骤ID")
		return
	}

	log, err := h.pipelineV2Service.GetStepLog(stepID)
	if err != nil {
		response.NotFound(c, "步骤不存在")
		return
	}

	response.Success(c, gin.H{"log": log})
}

// --- 审批 ---

func (h *Handler) ApproveRun(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	var req struct {
		Comment string `json:"comment"`
	}
	c.ShouldBindJSON(&req)

	claims := middleware.GetCurrentUser(c)
	if claims == nil {
		response.Error(c, 4010, "未登录")
		return
	}

	if err := h.pipelineV2Service.ApproveRun(id, claims.UserID, claims.Username, req.Comment); err != nil {
		if err == service.ErrApprovalNotPending {
			response.Error(c, 6001, "没有待审批的阶段")
			return
		}
		response.ServerError(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "审批通过", nil)
}

func (h *Handler) RejectRun(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	var req struct {
		Comment string `json:"comment"`
	}
	c.ShouldBindJSON(&req)

	claims := middleware.GetCurrentUser(c)
	if claims == nil {
		response.Error(c, 4010, "未登录")
		return
	}

	if err := h.pipelineV2Service.RejectRun(id, claims.UserID, claims.Username, req.Comment); err != nil {
		if err == service.ErrApprovalNotPending {
			response.Error(c, 6001, "没有待审批的阶段")
			return
		}
		response.ServerError(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "已拒绝", nil)
}

func (h *Handler) ListPendingApprovals(c *gin.Context) {
	page := getIntParam(c, "page", 1)
	pageSize := getIntParam(c, "page_size", 20)

	stages, total, err := h.pipelineV2Service.ListPendingApprovals(page, pageSize)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.SuccessPage(c, stages, total, page, pageSize)
}

// --- 制品 ---

func (h *Handler) ListArtifacts(c *gin.Context) {
	page := getIntParam(c, "page", 1)
	pageSize := getIntParam(c, "page_size", 20)

	var appID *uuid.UUID
	if aid := c.Query("app_id"); aid != "" {
		if id, err := uuid.Parse(aid); err == nil {
			appID = &id
		}
	}

	var runID *uuid.UUID
	if rid := c.Query("pipeline_run_id"); rid != "" {
		if id, err := uuid.Parse(rid); err == nil {
			runID = &id
		}
	}

	artifacts, total, err := h.pipelineV2Service.ListArtifacts(page, pageSize, appID, runID)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.SuccessPage(c, artifacts, total, page, pageSize)
}

func (h *Handler) CreateArtifact(c *gin.Context) {
	var req service.CreateArtifactRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	claims := middleware.GetCurrentUser(c)
	if claims == nil {
		response.Error(c, 4010, "未登录")
		return
	}

	artifact, err := h.pipelineV2Service.CreateArtifact(&req, claims.UserID)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, artifact)
}

func (h *Handler) GetArtifact(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	artifact, err := h.pipelineV2Service.GetArtifact(id)
	if err != nil {
		response.NotFound(c, "制品不存在")
		return
	}

	response.Success(c, artifact)
}

func (h *Handler) DeleteArtifact(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	if err := h.pipelineV2Service.DeleteArtifact(id); err != nil {
		if err == service.ErrArtifactNotFound {
			response.NotFound(c, "制品不存在")
			return
		}
		response.ServerError(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "删除成功", nil)
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
