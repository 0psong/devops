package monitor

import (
	"strconv"

	"devops/internal/pkg/response"
	"devops/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	hostService      *service.HostService
	hostGroupService *service.HostGroupService
	hostTagService   *service.HostTagService
}

func NewHandler(
	hostService *service.HostService,
	hostGroupService *service.HostGroupService,
	hostTagService *service.HostTagService,
) *Handler {
	return &Handler{
		hostService:      hostService,
		hostGroupService: hostGroupService,
		hostTagService:   hostTagService,
	}
}

func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	hosts := r.Group("/hosts")
	{
		hosts.GET("", h.ListHosts)
		hosts.POST("", h.CreateHost)
		hosts.GET("/:id", h.GetHost)
		hosts.PUT("/:id", h.UpdateHost)
		hosts.DELETE("/:id", h.DeleteHost)
		hosts.POST("/:id/test", h.TestConnection)
	}

	groups := r.Group("/host-groups")
	{
		groups.GET("", h.ListHostGroups)
		groups.POST("", h.CreateHostGroup)
		groups.DELETE("/:id", h.DeleteHostGroup)
	}

	tags := r.Group("/host-tags")
	{
		tags.GET("", h.ListHostTags)
		tags.POST("", h.CreateHostTag)
		tags.DELETE("/:id", h.DeleteHostTag)
	}
}

// Host handlers
func (h *Handler) ListHosts(c *gin.Context) {
	page := getIntParam(c, "page", 1)
	pageSize := getIntParam(c, "page_size", 20)
	keyword := c.Query("keyword")

	var groupID *uuid.UUID
	if gid := c.Query("group_id"); gid != "" {
		if id, err := uuid.Parse(gid); err == nil {
			groupID = &id
		}
	}

	var status *int
	if s := c.Query("status"); s != "" {
		st := getIntParam(c, "status", -1)
		if st >= 0 {
			status = &st
		}
	}

	hosts, total, err := h.hostService.List(page, pageSize, groupID, keyword, status)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.SuccessPage(c, hosts, total, page, pageSize)
}

func (h *Handler) CreateHost(c *gin.Context) {
	var req service.CreateHostRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	host, err := h.hostService.Create(&req)
	if err != nil {
		if err == service.ErrHostIPExists {
			response.Error(c, 2001, "主机IP已存在")
			return
		}
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, host)
}

func (h *Handler) GetHost(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	host, err := h.hostService.GetByID(id)
	if err != nil {
		response.NotFound(c, "主机不存在")
		return
	}

	response.Success(c, host)
}

func (h *Handler) UpdateHost(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	var req service.UpdateHostRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	host, err := h.hostService.Update(id, &req)
	if err != nil {
		if err == service.ErrHostNotFound {
			response.NotFound(c, "主机不存在")
			return
		}
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, host)
}

func (h *Handler) DeleteHost(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	if err := h.hostService.Delete(id); err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "删除成功", nil)
}

func (h *Handler) TestConnection(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	if err := h.hostService.TestConnection(id); err != nil {
		response.Error(c, 2002, "连接测试失败: "+err.Error())
		return
	}

	response.SuccessWithMessage(c, "连接成功", nil)
}

// Host Group handlers
func (h *Handler) ListHostGroups(c *gin.Context) {
	groups, err := h.hostGroupService.List()
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, groups)
}

func (h *Handler) CreateHostGroup(c *gin.Context) {
	var req struct {
		Name        string     `json:"name" binding:"required"`
		Description string     `json:"description"`
		ParentID    *uuid.UUID `json:"parent_id"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	group, err := h.hostGroupService.Create(req.Name, req.Description, req.ParentID)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, group)
}

func (h *Handler) DeleteHostGroup(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	if err := h.hostGroupService.Delete(id); err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "删除成功", nil)
}

// Host Tag handlers
func (h *Handler) ListHostTags(c *gin.Context) {
	tags, err := h.hostTagService.List()
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, tags)
}

func (h *Handler) CreateHostTag(c *gin.Context) {
	var req struct {
		Name  string `json:"name" binding:"required"`
		Color string `json:"color"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	color := req.Color
	if color == "" {
		color = "#1890ff"
	}

	tag, err := h.hostTagService.Create(req.Name, color)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, tag)
}

func (h *Handler) DeleteHostTag(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	if err := h.hostTagService.Delete(id); err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "删除成功", nil)
}

// Helper function
func getIntParam(c *gin.Context, key string, defaultVal int) int {
	val := c.Query(key)
	if val == "" {
		return defaultVal
	}
	n, err := strconv.Atoi(val)
	if err != nil {
		return defaultVal
	}
	return n
}
