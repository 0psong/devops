package k8s

import (
	"strconv"

	"devops/internal/middleware"
	"devops/internal/pkg/response"
	"devops/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	k8sService *service.K8sService
}

func NewHandler(k8sService *service.K8sService) *Handler {
	return &Handler{k8sService: k8sService}
}

func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	clusters := r.Group("/clusters")
	{
		clusters.GET("", h.ListClusters)
		clusters.POST("", h.CreateCluster)
		clusters.GET("/:id", h.GetCluster)
		clusters.PUT("/:id", h.UpdateCluster)
		clusters.DELETE("/:id", h.DeleteCluster)
		clusters.POST("/:id/test", h.TestConnection)
		clusters.GET("/:id/yaml", h.GetResourceYAML)
		clusters.GET("/:id/history", h.GetYAMLHistory)
		clusters.POST("/:id/apply", h.ApplyYAML)
		clusters.POST("/:id/format", h.FormatYAML)
		clusters.GET("/:id/overview", h.GetClusterOverview)
		clusters.GET("/:id/nodes", h.GetNodes)
		clusters.GET("/:id/namespaces", h.GetNamespaces)
		clusters.GET("/:id/deployments", h.GetDeployments)
		clusters.GET("/:id/pods", h.GetPods)
		clusters.GET("/:id/pods/logs", h.GetPodLogs)
		clusters.GET("/:id/pods/containers", h.GetPodContainers)
		clusters.GET("/:id/services", h.GetServices)
		clusters.GET("/:id/deployments/:ns/:name/revisions", h.GetDeploymentRevisions)
		clusters.POST("/:id/deployments/:ns/:name/rollback", h.RollbackDeployment)
		clusters.POST("/:id/nodes/:name/cordon", h.CordonNode)
		clusters.POST("/:id/nodes/:name/uncordon", h.UncordonNode)
		clusters.POST("/:id/nodes/:name/drain", h.DrainNode)
	}
}

func (h *Handler) ListClusters(c *gin.Context) {
	page := getIntParam(c, "page", 1)
	pageSize := getIntParam(c, "page_size", 20)
	envCode := c.Query("env_code")
	keyword := c.Query("keyword")

	clusters, total, err := h.k8sService.ListClusters(page, pageSize, envCode, keyword)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.SuccessPage(c, clusters, total, page, pageSize)
}

func (h *Handler) CreateCluster(c *gin.Context) {
	var req service.CreateClusterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	claims := middleware.GetCurrentUser(c)
	cluster, err := h.k8sService.CreateCluster(&req, claims.UserID)
	if err != nil {
		if err == service.ErrClusterCodeExists {
			response.Error(c, 4001, "集群代码已存在")
			return
		}
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, cluster)
}

func (h *Handler) GetCluster(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	cluster, err := h.k8sService.GetCluster(id)
	if err != nil {
		response.NotFound(c, "集群不存在")
		return
	}

	response.Success(c, cluster)
}

func (h *Handler) UpdateCluster(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	var req service.UpdateClusterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	cluster, err := h.k8sService.UpdateCluster(id, &req)
	if err != nil {
		if err == service.ErrClusterNotFound {
			response.NotFound(c, "集群不存在")
			return
		}
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, cluster)
}

func (h *Handler) DeleteCluster(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	if err := h.k8sService.DeleteCluster(id); err != nil {
		if err == service.ErrClusterNotFound {
			response.NotFound(c, "集群不存在")
			return
		}
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

	overview, err := h.k8sService.TestConnection(id)
	if err != nil {
		if err == service.ErrClusterConnect {
			response.Error(c, 4002, "集群连接失败")
			return
		}
		response.ServerError(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "连接成功", overview)
}

func (h *Handler) GetClusterOverview(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	overview, err := h.k8sService.GetClusterOverview(id)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, overview)
}

func (h *Handler) GetNodes(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	nodes, err := h.k8sService.GetNodes(id)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, nodes)
}

func (h *Handler) GetNamespaces(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	namespaces, err := h.k8sService.GetNamespaces(id)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, namespaces)
}

func (h *Handler) GetDeployments(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	namespace := c.DefaultQuery("namespace", "")
	deployments, err := h.k8sService.GetDeployments(id, namespace)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, deployments)
}

func (h *Handler) GetPods(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	namespace := c.DefaultQuery("namespace", "")
	pods, err := h.k8sService.GetPods(id, namespace)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, pods)
}

func (h *Handler) GetServices(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	namespace := c.DefaultQuery("namespace", "")
	services, err := h.k8sService.GetServices(id, namespace)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, services)
}

func (h *Handler) GetResourceYAML(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	kind := c.Query("kind")
	name := c.Query("name")
	namespace := c.Query("namespace")
	if kind == "" || name == "" {
		response.BadRequest(c, "kind 与 name 必填")
		return
	}

	yaml, err := h.k8sService.GetResourceYAML(id, kind, name, namespace)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, yaml)
}

func (h *Handler) ApplyYAML(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	var req service.ApplyYAMLRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	claims := middleware.GetCurrentUser(c)
	if claims == nil {
		response.Error(c, 4010, "未登录")
		return
	}

	results, err := h.k8sService.ApplyYAML(id, req.YAML, req.Namespace, req.DryRun, req.Action, claims.UserID, claims.Username)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	message := "YAML 已应用"
	if req.DryRun {
		message = "YAML 校验通过"
	}
	response.SuccessWithMessage(c, message, results)
}

func (h *Handler) GetYAMLHistory(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	kind := c.Query("kind")
	name := c.Query("name")
	namespace := c.Query("namespace")
	limit := getIntParam(c, "limit", 20)
	if limit <= 0 {
		limit = 20
	}

	histories, err := h.k8sService.ListYAMLHistory(id, kind, namespace, name, limit)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, histories)
}

func (h *Handler) FormatYAML(c *gin.Context) {
	var req service.FormatYAMLRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	formatted, err := h.k8sService.FormatYAML(req.YAML)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, formatted)
}

func (h *Handler) GetPodLogs(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	namespace := c.Query("namespace")
	podName := c.Query("pod")
	container := c.Query("container")
	if podName == "" {
		response.BadRequest(c, "需要提供 pod 名称")
		return
	}

	tailLines := int64(getIntParam(c, "tail", 200))
	previous := c.Query("previous") == "true"

	logs, err := h.k8sService.GetPodLogs(id, namespace, podName, container, tailLines, previous)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, logs)
}

func (h *Handler) GetPodContainers(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	namespace := c.Query("namespace")
	podName := c.Query("pod")
	if podName == "" {
		response.BadRequest(c, "需要提供 pod 名称")
		return
	}

	containers, err := h.k8sService.GetPodContainers(id, namespace, podName)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, containers)
}

func (h *Handler) GetDeploymentRevisions(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	ns := c.Param("ns")
	name := c.Param("name")

	revisions, err := h.k8sService.GetDeploymentRevisions(id, ns, name)
	if err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.Success(c, revisions)
}

func (h *Handler) RollbackDeployment(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	ns := c.Param("ns")
	name := c.Param("name")

	var req service.RollbackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	if err := h.k8sService.RollbackDeployment(id, ns, name, req.Revision); err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "回滚成功", nil)
}

func (h *Handler) CordonNode(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	nodeName := c.Param("name")
	if err := h.k8sService.CordonNode(id, nodeName); err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "节点已标记为不可调度", nil)
}

func (h *Handler) UncordonNode(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	nodeName := c.Param("name")
	if err := h.k8sService.UncordonNode(id, nodeName); err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "节点已恢复调度", nil)
}

func (h *Handler) DrainNode(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "无效的ID")
		return
	}

	nodeName := c.Param("name")
	if err := h.k8sService.DrainNode(id, nodeName); err != nil {
		response.ServerError(c, err.Error())
		return
	}

	response.SuccessWithMessage(c, "节点排空完成", nil)
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
