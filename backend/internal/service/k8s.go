package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"strings"
	"time"

	"devops/internal/model"
	"devops/internal/pkg/crypto"
	"devops/internal/repository"

	"github.com/google/uuid"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	yamlutil "k8s.io/apimachinery/pkg/util/yaml"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/discovery/cached/memory"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/restmapper"
	"k8s.io/client-go/tools/clientcmd"
	"sigs.k8s.io/yaml"
)

var (
	ErrClusterNotFound  = errors.New("cluster not found")
	ErrClusterCodeExists = errors.New("cluster code already exists")
	ErrClusterConnect   = errors.New("failed to connect to cluster")
)

type K8sService struct {
	clusterRepo  *repository.ClusterRepository
	historyRepo  *repository.K8sYAMLHistoryRepository
	encryptor    *crypto.Encryptor
	historyLimit int
}

func NewK8sService(clusterRepo *repository.ClusterRepository, historyRepo *repository.K8sYAMLHistoryRepository, encryptKey string) *K8sService {
	return &K8sService{
		clusterRepo:  clusterRepo,
		historyRepo:  historyRepo,
		encryptor:    crypto.NewEncryptor(encryptKey),
		historyLimit: 20,
	}
}

// --- Cluster CRUD ---

type CreateClusterRequest struct {
	Name        string `json:"name" binding:"required"`
	Code        string `json:"code" binding:"required"`
	APIServer   string `json:"api_server" binding:"required"`
	KubeConfig  string `json:"kubeconfig" binding:"required"`
	EnvCode     string `json:"env_code"`
	Description string `json:"description"`
}

func (s *K8sService) CreateCluster(req *CreateClusterRequest, createdBy uuid.UUID) (*model.Cluster, error) {
	if _, err := s.clusterRepo.GetByCode(req.Code); err == nil {
		return nil, ErrClusterCodeExists
	}

	// Encrypt kubeconfig
	encrypted, err := s.encryptor.Encrypt(req.KubeConfig)
	if err != nil {
		return nil, fmt.Errorf("encrypt kubeconfig: %w", err)
	}

	cluster := &model.Cluster{
		Name:        req.Name,
		Code:        req.Code,
		APIServer:   req.APIServer,
		KubeConfig:  encrypted,
		EnvCode:     req.EnvCode,
		Description: req.Description,
		Status:      1,
		CreatedBy:   createdBy,
	}

	// Test connection and get version
	client, err := s.getClient(req.KubeConfig)
	if err == nil {
		ver, verErr := client.Discovery().ServerVersion()
		if verErr == nil {
			cluster.Version = ver.GitVersion
		}
		// Get node/pod count
		nodes, _ := client.CoreV1().Nodes().List(context.Background(), metav1.ListOptions{})
		if nodes != nil {
			cluster.NodeCount = len(nodes.Items)
		}
		pods, _ := client.CoreV1().Pods("").List(context.Background(), metav1.ListOptions{})
		if pods != nil {
			cluster.PodCount = len(pods.Items)
		}
		now := time.Now()
		cluster.LastCheckAt = &now
	} else {
		cluster.Status = 2 // 连接失败
	}

	if err := s.clusterRepo.Create(cluster); err != nil {
		return nil, err
	}

	return s.clusterRepo.GetByID(cluster.ID)
}

type UpdateClusterRequest struct {
	Name        string `json:"name"`
	APIServer   string `json:"api_server"`
	KubeConfig  string `json:"kubeconfig"`
	EnvCode     string `json:"env_code"`
	Description string `json:"description"`
}

type ApplyYAMLRequest struct {
	YAML      string `json:"yaml" binding:"required"`
	Namespace string `json:"namespace"`
	DryRun    bool   `json:"dry_run"`
	Action    string `json:"action"`
}

type ApplyYAMLResult struct {
	Kind      string `json:"kind"`
	Name      string `json:"name"`
	Namespace string `json:"namespace,omitempty"`
	Action    string `json:"action"`
}

type FormatYAMLRequest struct {
	YAML string `json:"yaml" binding:"required"`
}

var kindAPIVersionMap = map[string]string{
	"Deployment":  "apps/v1",
	"StatefulSet": "apps/v1",
	"DaemonSet":   "apps/v1",
	"CronJob":     "batch/v1",
	"Service":     "v1",
	"Ingress":     "networking.k8s.io/v1",
	"ConfigMap":   "v1",
	"Secret":      "v1",
	"Pod":         "v1",
	"Namespace":   "v1",
	"Node":        "v1",
}

func (s *K8sService) UpdateCluster(id uuid.UUID, req *UpdateClusterRequest) (*model.Cluster, error) {
	cluster, err := s.clusterRepo.GetByID(id)
	if err != nil {
		return nil, ErrClusterNotFound
	}

	if req.Name != "" {
		cluster.Name = req.Name
	}
	if req.APIServer != "" {
		cluster.APIServer = req.APIServer
	}
	if req.KubeConfig != "" {
		encrypted, err := s.encryptor.Encrypt(req.KubeConfig)
		if err != nil {
			return nil, fmt.Errorf("encrypt kubeconfig: %w", err)
		}
		cluster.KubeConfig = encrypted
	}
	if req.EnvCode != "" {
		cluster.EnvCode = req.EnvCode
	}
	if req.Description != "" {
		cluster.Description = req.Description
	}

	if err := s.clusterRepo.Update(cluster); err != nil {
		return nil, err
	}

	return s.clusterRepo.GetByID(id)
}

func (s *K8sService) DeleteCluster(id uuid.UUID) error {
	if _, err := s.clusterRepo.GetByID(id); err != nil {
		return ErrClusterNotFound
	}
	return s.clusterRepo.Delete(id)
}

func (s *K8sService) GetCluster(id uuid.UUID) (*model.Cluster, error) {
	return s.clusterRepo.GetByID(id)
}

func (s *K8sService) ListClusters(page, pageSize int, envCode, keyword string) ([]model.Cluster, int64, error) {
	return s.clusterRepo.List(page, pageSize, envCode, keyword)
}

// --- 连接测试 ---

func (s *K8sService) TestConnection(id uuid.UUID) (*model.ClusterOverview, error) {
	cluster, err := s.clusterRepo.GetByID(id)
	if err != nil {
		return nil, ErrClusterNotFound
	}

	kubeconfig, err := s.encryptor.Decrypt(cluster.KubeConfig)
	if err != nil {
		return nil, fmt.Errorf("decrypt kubeconfig: %w", err)
	}

	client, err := s.getClient(kubeconfig)
	if err != nil {
		s.clusterRepo.UpdateStatus(id, 2, 0, 0)
		return nil, ErrClusterConnect
	}

	overview, err := s.getClusterOverview(client)
	if err != nil {
		s.clusterRepo.UpdateStatus(id, 2, 0, 0)
		return nil, err
	}

	s.clusterRepo.UpdateStatus(id, 1, overview.NodeCount, overview.PodCount)
	return overview, nil
}

// --- 资源查询 ---

func (s *K8sService) GetClusterOverview(id uuid.UUID) (*model.ClusterOverview, error) {
	client, err := s.getClientByClusterID(id)
	if err != nil {
		return nil, err
	}
	return s.getClusterOverview(client)
}

func (s *K8sService) GetNodes(id uuid.UUID) ([]model.K8sNode, error) {
	client, err := s.getClientByClusterID(id)
	if err != nil {
		return nil, err
	}

	ctx := context.Background()
	nodeList, err := client.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("list nodes: %w", err)
	}

	var nodes []model.K8sNode
	for _, n := range nodeList.Items {
		node := model.K8sNode{
			Name:              n.Name,
			OSImage:           n.Status.NodeInfo.OSImage,
			KernelVersion:     n.Status.NodeInfo.KernelVersion,
			ContainerRuntime:  n.Status.NodeInfo.ContainerRuntimeVersion,
			KubeletVersion:    n.Status.NodeInfo.KubeletVersion,
			CPUCapacity:       n.Status.Capacity.Cpu().String(),
			CPUAllocatable:    n.Status.Allocatable.Cpu().String(),
			MemoryCapacity:    n.Status.Capacity.Memory().String(),
			MemoryAllocatable: n.Status.Allocatable.Memory().String(),
			PodCapacity:       n.Status.Capacity.Pods().String(),
			CreatedAt:         n.CreationTimestamp.Time,
		}

		// Roles
		for label := range n.Labels {
			if strings.HasPrefix(label, "node-role.kubernetes.io/") {
				role := strings.TrimPrefix(label, "node-role.kubernetes.io/")
				if role != "" {
					node.Roles = append(node.Roles, role)
				}
			}
		}
		if len(node.Roles) == 0 {
			node.Roles = []string{"worker"}
		}

		// IPs
		for _, addr := range n.Status.Addresses {
			switch addr.Type {
			case corev1.NodeInternalIP:
				node.InternalIP = addr.Address
			case corev1.NodeExternalIP:
				node.ExternalIP = addr.Address
			}
		}

		// Status
		node.Status = "NotReady"
		for _, cond := range n.Status.Conditions {
			node.Conditions = append(node.Conditions, model.NodeCondition{
				Type:    string(cond.Type),
				Status:  string(cond.Status),
				Message: cond.Message,
			})
			if cond.Type == corev1.NodeReady && cond.Status == corev1.ConditionTrue {
				node.Status = "Ready"
			}
		}

		nodes = append(nodes, node)
	}

	return nodes, nil
}

func (s *K8sService) GetNamespaces(id uuid.UUID) ([]model.K8sNamespace, error) {
	client, err := s.getClientByClusterID(id)
	if err != nil {
		return nil, err
	}

	ctx := context.Background()
	nsList, err := client.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("list namespaces: %w", err)
	}

	var namespaces []model.K8sNamespace
	for _, ns := range nsList.Items {
		namespaces = append(namespaces, model.K8sNamespace{
			Name:      ns.Name,
			Status:    string(ns.Status.Phase),
			Labels:    ns.Labels,
			CreatedAt: ns.CreationTimestamp.Time,
		})
	}

	return namespaces, nil
}

func (s *K8sService) GetDeployments(id uuid.UUID, namespace string) ([]model.K8sResource, error) {
	client, err := s.getClientByClusterID(id)
	if err != nil {
		return nil, err
	}

	ctx := context.Background()
	deployList, err := client.AppsV1().Deployments(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("list deployments: %w", err)
	}

	var resources []model.K8sResource
	for _, d := range deployList.Items {
		status := "Running"
		if d.Status.ReadyReplicas < *d.Spec.Replicas {
			status = "Progressing"
		}
		if d.Status.ReadyReplicas == 0 && *d.Spec.Replicas > 0 {
			status = "NotReady"
		}

		var images []string
		for _, c := range d.Spec.Template.Spec.Containers {
			images = append(images, c.Image)
		}

		resources = append(resources, model.K8sResource{
			Name:      d.Name,
			Namespace: d.Namespace,
			Kind:      "Deployment",
			Replicas:  *d.Spec.Replicas,
			Ready:     d.Status.ReadyReplicas,
			Status:    status,
			Images:    images,
			CreatedAt: d.CreationTimestamp.Time,
		})
	}

	return resources, nil
}

func (s *K8sService) GetPods(id uuid.UUID, namespace string) ([]model.K8sResource, error) {
	client, err := s.getClientByClusterID(id)
	if err != nil {
		return nil, err
	}

	ctx := context.Background()
	podList, err := client.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("list pods: %w", err)
	}

	var resources []model.K8sResource
	for _, p := range podList.Items {
		var images []string
		for _, c := range p.Spec.Containers {
			images = append(images, c.Image)
		}

		resources = append(resources, model.K8sResource{
			Name:      p.Name,
			Namespace: p.Namespace,
			Kind:      "Pod",
			Status:    string(p.Status.Phase),
			Images:    images,
			CreatedAt: p.CreationTimestamp.Time,
		})
	}

	return resources, nil
}

func (s *K8sService) GetServices(id uuid.UUID, namespace string) ([]model.K8sResource, error) {
	client, err := s.getClientByClusterID(id)
	if err != nil {
		return nil, err
	}

	ctx := context.Background()
	svcList, err := client.CoreV1().Services(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("list services: %w", err)
	}

	var resources []model.K8sResource
	for _, svc := range svcList.Items {
		resources = append(resources, model.K8sResource{
			Name:      svc.Name,
			Namespace: svc.Namespace,
			Kind:      "Service",
			Status:    string(svc.Spec.Type),
			CreatedAt: svc.CreationTimestamp.Time,
		})
	}

	return resources, nil
}

func (s *K8sService) ApplyYAML(id uuid.UUID, yamlText, defaultNamespace string, dryRun bool, action string, createdBy uuid.UUID, username string) ([]ApplyYAMLResult, error) {
	if action == "" {
		action = "apply"
	}
	cfg, err := s.getRestConfigByClusterID(id)
	if err != nil {
		return nil, err
	}

	dynClient, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return nil, fmt.Errorf("create dynamic client: %w", err)
	}

	discoveryClient, err := discovery.NewDiscoveryClientForConfig(cfg)
	if err != nil {
		return nil, fmt.Errorf("create discovery client: %w", err)
	}

	mapper := restmapper.NewDeferredDiscoveryRESTMapper(memory.NewMemCacheClient(discoveryClient))
	decoder := yamlutil.NewYAMLOrJSONDecoder(strings.NewReader(yamlText), 4096)
	ctx := context.Background()

	var results []ApplyYAMLResult

	for {
		var raw map[string]interface{}
		if err := decoder.Decode(&raw); err != nil {
			if err == io.EOF {
				break
			}
			return nil, fmt.Errorf("decode yaml: %w", err)
		}
		if len(raw) == 0 {
			continue
		}

		obj := &unstructured.Unstructured{Object: raw}
		objects, err := expandUnstructuredObjects(obj)
		if err != nil {
			return nil, err
		}

		for _, item := range objects {
			gvk := item.GroupVersionKind()
			if gvk.Empty() {
				return nil, errors.New("yaml 缺少 apiVersion 或 kind")
			}
			if item.GetName() == "" {
				return nil, fmt.Errorf("%s 缺少 metadata.name", gvk.Kind)
			}

			mapping, err := mapper.RESTMapping(gvk.GroupKind(), gvk.Version)
			if err != nil {
				return nil, fmt.Errorf("map resource %s: %w", gvk.String(), err)
			}

			resource := dynClient.Resource(mapping.Resource)
			var ri dynamic.ResourceInterface
			if mapping.Scope.Name() == meta.RESTScopeNameNamespace {
				ns := item.GetNamespace()
				if ns == "" {
					ns = defaultNamespace
				}
				if ns == "" {
					return nil, fmt.Errorf("%s/%s 缺少 namespace", gvk.Kind, item.GetName())
				}
				item.SetNamespace(ns)
				ri = resource.Namespace(ns)
			} else {
				item.SetNamespace("")
				ri = resource
			}

			sanitizeUnstructured(item)

			payload, err := json.Marshal(item)
			if err != nil {
				return nil, fmt.Errorf("encode %s/%s: %w", gvk.Kind, item.GetName(), err)
			}

			force := true
			patchOptions := metav1.PatchOptions{
				FieldManager: "devops-ui",
				Force:        &force,
			}
			if dryRun {
				patchOptions.DryRun = []string{metav1.DryRunAll}
			}
			if _, err := ri.Patch(ctx, item.GetName(), types.ApplyPatchType, payload, patchOptions); err != nil {
				return nil, fmt.Errorf("apply %s/%s: %w", gvk.Kind, item.GetName(), err)
			}

			if !dryRun && s.historyRepo != nil {
				yamlBytes, err := yaml.Marshal(item.Object)
				if err != nil {
					return nil, fmt.Errorf("encode yaml history: %w", err)
				}
				history := &model.K8sYAMLHistory{
					ClusterID: id,
					Kind:      gvk.Kind,
					Namespace: item.GetNamespace(),
					Name:      item.GetName(),
					YAML:      strings.TrimSpace(string(yamlBytes)),
					Action:    action,
					CreatedBy: createdBy,
					Username:  username,
					CreatedAt: time.Now(),
				}
				if err := s.historyRepo.Create(history); err != nil {
					log.Printf("Failed to create k8s yaml history: %v", err)
				}
				if err := s.historyRepo.TrimHistory(id, gvk.Kind, item.GetNamespace(), item.GetName(), s.historyLimit); err != nil {
					log.Printf("Failed to trim k8s yaml history: %v", err)
				}
			}

			action := "applied"
			if dryRun {
				action = "validated"
			}
			results = append(results, ApplyYAMLResult{
				Kind:      gvk.Kind,
				Name:      item.GetName(),
				Namespace: item.GetNamespace(),
				Action:    action,
			})
		}
	}

	if len(results) == 0 {
		return nil, errors.New("yaml 为空")
	}

	return results, nil
}

func (s *K8sService) FormatYAML(yamlText string) (string, error) {
	decoder := yamlutil.NewYAMLOrJSONDecoder(strings.NewReader(yamlText), 4096)
	var docs []string

	for {
		var raw map[string]interface{}
		if err := decoder.Decode(&raw); err != nil {
			if err == io.EOF {
				break
			}
			return "", fmt.Errorf("decode yaml: %w", err)
		}
		if len(raw) == 0 {
			continue
		}

		obj := &unstructured.Unstructured{Object: raw}
		objects, err := expandUnstructuredObjects(obj)
		if err != nil {
			return "", err
		}

		for _, item := range objects {
			gvk := item.GroupVersionKind()
			if gvk.Empty() {
				return "", errors.New("yaml 缺少 apiVersion 或 kind")
			}
			if item.GetName() == "" {
				return "", fmt.Errorf("%s 缺少 metadata.name", gvk.Kind)
			}

			sanitizeUnstructured(item)
			data, err := yaml.Marshal(item.Object)
			if err != nil {
				return "", fmt.Errorf("encode yaml: %w", err)
			}
			docs = append(docs, strings.TrimSpace(string(data)))
		}
	}

	if len(docs) == 0 {
		return "", errors.New("yaml 为空")
	}

	return strings.Join(docs, "\n---\n"), nil
}

func (s *K8sService) ListYAMLHistory(id uuid.UUID, kind, namespace, name string, limit int) ([]model.K8sYAMLHistory, error) {
	if kind == "" || name == "" {
		return nil, errors.New("kind 与 name 必填")
	}
	if s.historyRepo == nil {
		return []model.K8sYAMLHistory{}, nil
	}
	if limit <= 0 {
		limit = s.historyLimit
	}
	if limit > 50 {
		limit = 50
	}
	return s.historyRepo.ListByResource(id, kind, namespace, name, limit)
}

func (s *K8sService) GetResourceYAML(id uuid.UUID, kind, name, namespace string) (string, error) {
	if kind == "" || name == "" {
		return "", errors.New("kind 与 name 必填")
	}

	cfg, err := s.getRestConfigByClusterID(id)
	if err != nil {
		return "", err
	}

	dynClient, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return "", fmt.Errorf("create dynamic client: %w", err)
	}

	discoveryClient, err := discovery.NewDiscoveryClientForConfig(cfg)
	if err != nil {
		return "", fmt.Errorf("create discovery client: %w", err)
	}

	mapper := restmapper.NewDeferredDiscoveryRESTMapper(memory.NewMemCacheClient(discoveryClient))

	gvk, err := resolveGVK(kind)
	if err != nil {
		return "", err
	}

	mapping, err := mapper.RESTMapping(gvk.GroupKind(), gvk.Version)
	if err != nil {
		return "", fmt.Errorf("map resource %s: %w", gvk.String(), err)
	}

	resource := dynClient.Resource(mapping.Resource)
	var ri dynamic.ResourceInterface
	if mapping.Scope.Name() == meta.RESTScopeNameNamespace {
		if namespace == "" {
			return "", fmt.Errorf("%s/%s 缺少 namespace", kind, name)
		}
		ri = resource.Namespace(namespace)
	} else {
		namespace = ""
		ri = resource
	}

	ctx := context.Background()
	obj, err := ri.Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("get %s/%s: %w", kind, name, err)
	}

	sanitizeUnstructured(obj)
	data, err := yaml.Marshal(obj.Object)
	if err != nil {
		return "", fmt.Errorf("encode yaml: %w", err)
	}

	return string(data), nil
}

// --- Pod Logs ---

func (s *K8sService) GetPodLogs(clusterID uuid.UUID, namespace, podName, container string, tailLines int64, previous bool) (string, error) {
	client, err := s.getClientByClusterID(clusterID)
	if err != nil {
		return "", err
	}

	ctx := context.Background()
	opts := &corev1.PodLogOptions{
		TailLines: &tailLines,
		Previous:  previous,
	}
	if container != "" {
		opts.Container = container
	}

	req := client.CoreV1().Pods(namespace).GetLogs(podName, opts)
	stream, err := req.Stream(ctx)
	if err != nil {
		return "", fmt.Errorf("get pod logs: %w", err)
	}
	defer stream.Close()

	buf := new(strings.Builder)
	if _, err := io.Copy(buf, stream); err != nil {
		return "", fmt.Errorf("read pod logs: %w", err)
	}

	return buf.String(), nil
}

func (s *K8sService) GetPodContainers(clusterID uuid.UUID, namespace, podName string) ([]string, error) {
	client, err := s.getClientByClusterID(clusterID)
	if err != nil {
		return nil, err
	}

	ctx := context.Background()
	pod, err := client.CoreV1().Pods(namespace).Get(ctx, podName, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("get pod: %w", err)
	}

	var containers []string
	for _, c := range pod.Spec.Containers {
		containers = append(containers, c.Name)
	}
	for _, c := range pod.Spec.InitContainers {
		containers = append(containers, c.Name)
	}

	return containers, nil
}

// --- Deployment Revision & Rollback ---

type RevisionInfo struct {
	Revision  int64     `json:"revision"`
	Name      string    `json:"name"`
	Images    []string  `json:"images"`
	CreatedAt time.Time `json:"created_at"`
}

func (s *K8sService) GetDeploymentRevisions(clusterID uuid.UUID, namespace, name string) ([]RevisionInfo, error) {
	client, err := s.getClientByClusterID(clusterID)
	if err != nil {
		return nil, err
	}

	ctx := context.Background()

	// Get the deployment
	deploy, err := client.AppsV1().Deployments(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("get deployment: %w", err)
	}

	// List ReplicaSets owned by this deployment
	selector, err := metav1.LabelSelectorAsSelector(deploy.Spec.Selector)
	if err != nil {
		return nil, fmt.Errorf("parse selector: %w", err)
	}

	rsList, err := client.AppsV1().ReplicaSets(namespace).List(ctx, metav1.ListOptions{
		LabelSelector: selector.String(),
	})
	if err != nil {
		return nil, fmt.Errorf("list replicasets: %w", err)
	}

	var revisions []RevisionInfo
	for _, rs := range rsList.Items {
		// Check ownership
		owned := false
		for _, ref := range rs.OwnerReferences {
			if ref.UID == deploy.UID {
				owned = true
				break
			}
		}
		if !owned {
			continue
		}

		revStr, ok := rs.Annotations["deployment.kubernetes.io/revision"]
		if !ok {
			continue
		}
		var rev int64
		fmt.Sscanf(revStr, "%d", &rev)

		var images []string
		for _, c := range rs.Spec.Template.Spec.Containers {
			images = append(images, c.Image)
		}

		revisions = append(revisions, RevisionInfo{
			Revision:  rev,
			Name:      rs.Name,
			Images:    images,
			CreatedAt: rs.CreationTimestamp.Time,
		})
	}

	return revisions, nil
}

type RollbackRequest struct {
	Revision int64 `json:"revision"`
}

func (s *K8sService) RollbackDeployment(clusterID uuid.UUID, namespace, name string, revision int64) error {
	client, err := s.getClientByClusterID(clusterID)
	if err != nil {
		return err
	}

	ctx := context.Background()

	// Get the target ReplicaSet with the specified revision
	deploy, err := client.AppsV1().Deployments(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return fmt.Errorf("get deployment: %w", err)
	}

	selector, err := metav1.LabelSelectorAsSelector(deploy.Spec.Selector)
	if err != nil {
		return fmt.Errorf("parse selector: %w", err)
	}

	rsList, err := client.AppsV1().ReplicaSets(namespace).List(ctx, metav1.ListOptions{
		LabelSelector: selector.String(),
	})
	if err != nil {
		return fmt.Errorf("list replicasets: %w", err)
	}

	var targetRS *appsv1.ReplicaSet
	for i, rs := range rsList.Items {
		owned := false
		for _, ref := range rs.OwnerReferences {
			if ref.UID == deploy.UID {
				owned = true
				break
			}
		}
		if !owned {
			continue
		}

		revStr := rs.Annotations["deployment.kubernetes.io/revision"]
		var rev int64
		fmt.Sscanf(revStr, "%d", &rev)
		if rev == revision {
			targetRS = &rsList.Items[i]
			break
		}
	}

	if targetRS == nil {
		return fmt.Errorf("revision %d not found", revision)
	}

	// Patch the deployment with the target RS's pod template
	deploy.Spec.Template = targetRS.Spec.Template
	_, err = client.AppsV1().Deployments(namespace).Update(ctx, deploy, metav1.UpdateOptions{})
	if err != nil {
		return fmt.Errorf("update deployment: %w", err)
	}

	return nil
}

// --- Node Management ---

func (s *K8sService) CordonNode(clusterID uuid.UUID, nodeName string) error {
	client, err := s.getClientByClusterID(clusterID)
	if err != nil {
		return err
	}

	ctx := context.Background()
	node, err := client.CoreV1().Nodes().Get(ctx, nodeName, metav1.GetOptions{})
	if err != nil {
		return fmt.Errorf("get node: %w", err)
	}

	node.Spec.Unschedulable = true
	_, err = client.CoreV1().Nodes().Update(ctx, node, metav1.UpdateOptions{})
	if err != nil {
		return fmt.Errorf("cordon node: %w", err)
	}

	return nil
}

func (s *K8sService) UncordonNode(clusterID uuid.UUID, nodeName string) error {
	client, err := s.getClientByClusterID(clusterID)
	if err != nil {
		return err
	}

	ctx := context.Background()
	node, err := client.CoreV1().Nodes().Get(ctx, nodeName, metav1.GetOptions{})
	if err != nil {
		return fmt.Errorf("get node: %w", err)
	}

	node.Spec.Unschedulable = false
	_, err = client.CoreV1().Nodes().Update(ctx, node, metav1.UpdateOptions{})
	if err != nil {
		return fmt.Errorf("uncordon node: %w", err)
	}

	return nil
}

func (s *K8sService) DrainNode(clusterID uuid.UUID, nodeName string) error {
	client, err := s.getClientByClusterID(clusterID)
	if err != nil {
		return err
	}

	ctx := context.Background()

	// First cordon the node
	node, err := client.CoreV1().Nodes().Get(ctx, nodeName, metav1.GetOptions{})
	if err != nil {
		return fmt.Errorf("get node: %w", err)
	}

	node.Spec.Unschedulable = true
	_, err = client.CoreV1().Nodes().Update(ctx, node, metav1.UpdateOptions{})
	if err != nil {
		return fmt.Errorf("cordon node: %w", err)
	}

	// Evict pods (skip DaemonSet pods and mirror pods)
	pods, err := client.CoreV1().Pods("").List(ctx, metav1.ListOptions{
		FieldSelector: "spec.nodeName=" + nodeName,
	})
	if err != nil {
		return fmt.Errorf("list pods on node: %w", err)
	}

	for _, pod := range pods.Items {
		// Skip DaemonSet pods
		isDaemonSet := false
		for _, ref := range pod.OwnerReferences {
			if ref.Kind == "DaemonSet" {
				isDaemonSet = true
				break
			}
		}
		if isDaemonSet {
			continue
		}

		// Skip mirror pods
		if _, ok := pod.Annotations["kubernetes.io/config.mirror"]; ok {
			continue
		}

		// Delete pod with grace period
		gracePeriod := int64(30)
		err := client.CoreV1().Pods(pod.Namespace).Delete(ctx, pod.Name, metav1.DeleteOptions{
			GracePeriodSeconds: &gracePeriod,
		})
		if err != nil {
			log.Printf("Failed to evict pod %s/%s: %v", pod.Namespace, pod.Name, err)
		}
	}

	return nil
}

// --- 内部方法 ---

func (s *K8sService) getClient(kubeconfig string) (*kubernetes.Clientset, error) {
	config, err := s.getRestConfig(kubeconfig)
	if err != nil {
		return nil, err
	}

	client, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("create client: %w", err)
	}

	return client, nil
}

func (s *K8sService) getClientByClusterID(id uuid.UUID) (*kubernetes.Clientset, error) {
	config, err := s.getRestConfigByClusterID(id)
	if err != nil {
		return nil, err
	}

	client, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("create client: %w", err)
	}

	return client, nil
}

func (s *K8sService) getRestConfig(kubeconfig string) (*rest.Config, error) {
	config, err := clientcmd.RESTConfigFromKubeConfig([]byte(kubeconfig))
	if err != nil {
		return nil, fmt.Errorf("parse kubeconfig: %w", err)
	}

	config.Timeout = 10 * time.Second

	return config, nil
}

func (s *K8sService) getRestConfigByClusterID(id uuid.UUID) (*rest.Config, error) {
	cluster, err := s.clusterRepo.GetByID(id)
	if err != nil {
		return nil, ErrClusterNotFound
	}

	kubeconfig, err := s.encryptor.Decrypt(cluster.KubeConfig)
	if err != nil {
		return nil, fmt.Errorf("decrypt kubeconfig: %w", err)
	}

	return s.getRestConfig(kubeconfig)
}

func (s *K8sService) getClusterOverview(client *kubernetes.Clientset) (*model.ClusterOverview, error) {
	ctx := context.Background()
	overview := &model.ClusterOverview{}

	// Version
	ver, err := client.Discovery().ServerVersion()
	if err != nil {
		return nil, fmt.Errorf("get server version: %w", err)
	}
	overview.Version = ver.GitVersion

	// Nodes
	nodes, err := client.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err == nil {
		overview.NodeCount = len(nodes.Items)
		for _, n := range nodes.Items {
			for _, cond := range n.Status.Conditions {
				if cond.Type == corev1.NodeReady && cond.Status == corev1.ConditionTrue {
					overview.ReadyNodes++
				}
			}
		}
	}

	// Pods
	pods, err := client.CoreV1().Pods("").List(ctx, metav1.ListOptions{})
	if err == nil {
		overview.PodCount = len(pods.Items)
		for _, p := range pods.Items {
			if p.Status.Phase == corev1.PodRunning {
				overview.RunningPods++
			}
		}
	}

	// Namespaces
	namespaces, err := client.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err == nil {
		overview.NamespaceCount = len(namespaces.Items)
	}

	// Deployments
	deployments, err := client.AppsV1().Deployments("").List(ctx, metav1.ListOptions{})
	if err == nil {
		overview.DeploymentCount = len(deployments.Items)
	}

	// Services
	services, err := client.CoreV1().Services("").List(ctx, metav1.ListOptions{})
	if err == nil {
		overview.ServiceCount = len(services.Items)
	}

	_ = appsv1.SchemeGroupVersion // keep import

	return overview, nil
}

func resolveGVK(kind string) (schema.GroupVersionKind, error) {
	apiVersion, ok := kindAPIVersionMap[kind]
	if !ok {
		return schema.GroupVersionKind{}, fmt.Errorf("不支持的 kind: %s", kind)
	}
	return schema.FromAPIVersionAndKind(apiVersion, kind), nil
}

func sanitizeUnstructured(obj *unstructured.Unstructured) {
	unstructured.RemoveNestedField(obj.Object, "status")
	unstructured.RemoveNestedField(obj.Object, "metadata", "creationTimestamp")
	unstructured.RemoveNestedField(obj.Object, "metadata", "resourceVersion")
	unstructured.RemoveNestedField(obj.Object, "metadata", "uid")
	unstructured.RemoveNestedField(obj.Object, "metadata", "generation")
	unstructured.RemoveNestedField(obj.Object, "metadata", "selfLink")
	unstructured.RemoveNestedField(obj.Object, "metadata", "managedFields")
}

func expandUnstructuredObjects(obj *unstructured.Unstructured) ([]*unstructured.Unstructured, error) {
	if obj.IsList() {
		list := &unstructured.UnstructuredList{}
		list.Object = obj.Object
		items := make([]*unstructured.Unstructured, 0, len(list.Items))
		for i := range list.Items {
			items = append(items, list.Items[i].DeepCopy())
		}
		return items, nil
	}
	return []*unstructured.Unstructured{obj}, nil
}

