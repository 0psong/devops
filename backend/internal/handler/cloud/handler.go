package cloud

import (
	"strconv"

	"devops/internal/middleware"
	"devops/internal/pkg/response"
	"devops/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	cloudService *service.CloudService
}

func NewHandler(cloudService *service.CloudService) *Handler {
	return &Handler{cloudService: cloudService}
}

func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	cloud := r.Group("/cloud")
	{
		// 云账号
		accounts := cloud.Group("/accounts")
		{
			accounts.GET("", h.ListAccounts)
			accounts.POST("", h.CreateAccount)
			accounts.GET("/:id", h.GetAccount)
			accounts.PUT("/:id", h.UpdateAccount)
			accounts.DELETE("/:id", h.DeleteAccount)
			accounts.POST("/:id/verify", h.VerifyAccount)
			accounts.GET("/:id/regions", h.ListRegions)
			accounts.GET("/:id/zones", h.ListZones)
			accounts.GET("/:id/instance-types", h.ListInstanceTypes)
			accounts.GET("/:id/images", h.ListImages)
		}

		// 云实例
		instances := cloud.Group("/instances")
		{
			instances.GET("", h.ListInstances)
			instances.POST("", h.CreateInstance)
			instances.GET("/:id", h.GetInstance)
			instances.POST("/:id/start", h.StartInstance)
			instances.POST("/:id/stop", h.StopInstance)
			instances.POST("/:id/terminate", h.TerminateInstance)
			instances.POST("/:id/sync", h.SyncInstance)
			instances.POST("/:id/bindhost", h.BindHost)
			instances.POST("/:id/unbindhost", h.UnbindHost)
		}

		// 节点池
		nodepools := cloud.Group("/nodepools")
		{
			nodepools.GET("", h.ListNodePools)
			nodepools.POST("", h.CreateNodePool)
			nodepools.GET("/:id", h.GetNodePool)
			nodepools.PUT("/:id", h.UpdateNodePool)
			nodepools.DELETE("/:id", h.DeleteNodePool)
			nodepools.POST("/:id/scale", h.ScaleNodePool)
		}
	}
}

// --- 云账号 ---

func (h *Handler) ListAccounts(c *gin.Context) {
	page := getIntParam(c, "page", 1)
	pageSize := getIntParam(c, "page_size", 20)
	provider := c.Query("provider")
	keyword := c.Query("keyword")

	accounts, total, err := h.cloudService.ListAccounts(page, pageSize, provider, keyword)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.SuccessPage(c, accounts, total, page, pageSize)
}

func (h *Handler) CreateAccount(c *gin.Context) {
	var req service.CreateAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	claims := middleware.GetCurrentUser(c)
	if claims == nil {
		response.Error(c, 4010, "未登录")
		return
	}

	account, err := h.cloudService.CreateAccount(&req, claims.UserID)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, account)
}

func (h *Handler) GetAccount(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	account, err := h.cloudService.GetAccount(id)
	if err != nil {
		response.NotFound(c, "云账号不存在")
		return
	}

	response.Success(c, account)
}

func (h *Handler) UpdateAccount(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	var req service.UpdateAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	account, err := h.cloudService.UpdateAccount(id, &req)
	if err != nil {
		if err == service.ErrCloudAccountNotFound {
			response.NotFound(c, "云账号不存在")
			return
		}
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, account)
}

func (h *Handler) DeleteAccount(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	if err := h.cloudService.DeleteAccount(id); err != nil {
		if err == service.ErrCloudAccountNotFound {
			response.NotFound(c, "云账号不存在")
			return
		}
		response.ServerError(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "删除成功", nil)
}

func (h *Handler) VerifyAccount(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	if err := h.cloudService.VerifyAccount(id); err != nil {
		if err == service.ErrCloudAccountNotFound {
			response.NotFound(c, "云账号不存在")
			return
		}
		response.Error(c, 4002, err.Error())
		return
	}

	response.SuccessWithMessage(c, "验证成功", nil)
}

// --- 云资源查询 ---

func (h *Handler) ListRegions(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	regions, err := h.cloudService.ListRegions(id)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, regions)
}

func (h *Handler) ListZones(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	region := c.Query("region")
	zones, err := h.cloudService.ListZones(id, region)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, zones)
}

func (h *Handler) ListInstanceTypes(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	region := c.Query("region")
	types, err := h.cloudService.ListInstanceTypes(id, region)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, types)
}

func (h *Handler) ListImages(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	region := c.Query("region")
	images, err := h.cloudService.ListImages(id, region)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, images)
}

// --- 云实例 ---

func (h *Handler) ListInstances(c *gin.Context) {
	page := getIntParam(c, "page", 1)
	pageSize := getIntParam(c, "page_size", 20)
	status := c.Query("status")

	var accountID *uuid.UUID
	if aid := c.Query("account_id"); aid != "" {
		if id, err := uuid.Parse(aid); err == nil {
			accountID = &id
		}
	}

	var clusterID *uuid.UUID
	if cid := c.Query("cluster_id"); cid != "" {
		if id, err := uuid.Parse(cid); err == nil {
			clusterID = &id
		}
	}

	instances, total, err := h.cloudService.ListInstances(page, pageSize, accountID, status, clusterID)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.SuccessPage(c, instances, total, page, pageSize)
}

func (h *Handler) CreateInstance(c *gin.Context) {
	var req service.CreateInstanceReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	claims := middleware.GetCurrentUser(c)
	if claims == nil {
		response.Error(c, 4010, "未登录")
		return
	}

	instance, err := h.cloudService.CreateInstance(&req, claims.UserID)
	if err != nil {
		if err == service.ErrCloudAccountNotFound {
			response.NotFound(c, "云账号不存在")
			return
		}
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, instance)
}

func (h *Handler) GetInstance(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	instance, err := h.cloudService.GetInstance(id)
	if err != nil {
		response.NotFound(c, "实例不存在")
		return
	}

	response.Success(c, instance)
}

func (h *Handler) StartInstance(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	instance, err := h.cloudService.StartInstance(id)
	if err != nil {
		if err == service.ErrCloudInstanceNotFound {
			response.NotFound(c, "实例不存在")
			return
		}
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, instance)
}

func (h *Handler) StopInstance(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	instance, err := h.cloudService.StopInstance(id)
	if err != nil {
		if err == service.ErrCloudInstanceNotFound {
			response.NotFound(c, "实例不存在")
			return
		}
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, instance)
}

func (h *Handler) TerminateInstance(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	instance, err := h.cloudService.TerminateInstance(id)
	if err != nil {
		if err == service.ErrCloudInstanceNotFound {
			response.NotFound(c, "实例不存在")
			return
		}
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, instance)
}

func (h *Handler) SyncInstance(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	instance, err := h.cloudService.SyncInstance(id)
	if err != nil {
		if err == service.ErrCloudInstanceNotFound {
			response.NotFound(c, "实例不存在")
			return
		}
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, instance)
}

func (h *Handler) BindHost(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	instance, err := h.cloudService.BindHost(id)
	if err != nil {
		if err == service.ErrCloudInstanceNotFound {
			response.NotFound(c, "实例不存在")
			return
		}
		if err == service.ErrInstanceBound {
			response.Error(c, 4003, "实例已上架")
			return
		}
		response.ServerError(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "上架成功", instance)
}

func (h *Handler) UnbindHost(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	instance, err := h.cloudService.UnbindHost(id)
	if err != nil {
		if err == service.ErrCloudInstanceNotFound {
			response.NotFound(c, "实例不存在")
			return
		}
		if err == service.ErrInstanceNotBound {
			response.Error(c, 4004, "实例未上架")
			return
		}
		response.ServerError(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "下架成功", instance)
}

// --- 节点池 ---

func (h *Handler) ListNodePools(c *gin.Context) {
	page := getIntParam(c, "page", 1)
	pageSize := getIntParam(c, "page_size", 20)

	var clusterID *uuid.UUID
	if cid := c.Query("cluster_id"); cid != "" {
		if id, err := uuid.Parse(cid); err == nil {
			clusterID = &id
		}
	}

	pools, total, err := h.cloudService.ListNodePools(page, pageSize, clusterID)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.SuccessPage(c, pools, total, page, pageSize)
}

func (h *Handler) CreateNodePool(c *gin.Context) {
	var req service.CreateNodePoolRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	claims := middleware.GetCurrentUser(c)
	if claims == nil {
		response.Error(c, 4010, "未登录")
		return
	}

	pool, err := h.cloudService.CreateNodePool(&req, claims.UserID)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, pool)
}

func (h *Handler) GetNodePool(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	pool, err := h.cloudService.GetNodePool(id)
	if err != nil {
		response.NotFound(c, "节点池不存在")
		return
	}

	response.Success(c, pool)
}

func (h *Handler) UpdateNodePool(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	var req service.UpdateNodePoolRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	pool, err := h.cloudService.UpdateNodePool(id, &req)
	if err != nil {
		if err == service.ErrNodePoolNotFound {
			response.NotFound(c, "节点池不存在")
			return
		}
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, pool)
}

func (h *Handler) DeleteNodePool(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	if err := h.cloudService.DeleteNodePool(id); err != nil {
		if err == service.ErrNodePoolNotFound {
			response.NotFound(c, "节点池不存在")
			return
		}
		response.ServerError(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "删除成功", nil)
}

func (h *Handler) ScaleNodePool(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	var req service.ScaleNodePoolRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	pool, err := h.cloudService.ScaleNodePool(id, &req)
	if err != nil {
		if err == service.ErrNodePoolNotFound {
			response.NotFound(c, "节点池不存在")
			return
		}
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, pool)
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
