import api, { PageData } from './api'

export interface Cluster {
  id: string
  name: string
  code: string
  version: string
  api_server: string
  description: string
  env_code: string
  status: number
  node_count: number
  pod_count: number
  last_check_at: string
  created_at: string
}

export interface ClusterOverview {
  node_count: number
  ready_nodes: number
  pod_count: number
  running_pods: number
  namespace_count: number
  deployment_count: number
  service_count: number
  cpu_capacity: string
  cpu_usage: string
  mem_capacity: string
  mem_usage: string
  version: string
}

export interface K8sNode {
  name: string
  status: string
  roles: string[]
  internal_ip: string
  external_ip: string
  os_image: string
  kernel_version: string
  container_runtime: string
  kubelet_version: string
  cpu_capacity: string
  cpu_allocatable: string
  memory_capacity: string
  memory_allocatable: string
  pod_capacity: string
  created_at: string
  conditions: { type: string; status: string; message: string }[]
}

export interface K8sNamespace {
  name: string
  status: string
  labels: Record<string, string>
  created_at: string
}

export interface K8sResource {
  name: string
  namespace: string
  kind: string
  replicas: number
  ready: number
  status: string
  images: string[]
  created_at: string
  labels?: Record<string, string>
  schedule?: string
  last_schedule?: string
  yaml?: string
}

export interface K8sIngress {
  name: string
  namespace: string
  hosts: string[]
  rules: { host: string; paths: { path: string; backend: string; port: number }[] }[]
  created_at: string
  yaml?: string
}

export interface K8sConfigMap {
  name: string
  namespace: string
  data: Record<string, string>
  created_at: string
  yaml?: string
}

export interface K8sSecret {
  name: string
  namespace: string
  type: string
  data: Record<string, string>
  created_at: string
  yaml?: string
}

export interface K8sYamlHistory {
  id: string
  cluster_id: string
  kind: string
  namespace: string
  name: string
  yaml: string
  action: string
  created_by: string
  username: string
  created_at: string
}

export interface K8sApplyResult {
  kind: string
  name: string
  namespace?: string
  action: string
}

export interface CreateWorkloadParams {
  name: string
  namespace: string
  replicas?: number
  labels?: Record<string, string>
  image: string
  ports?: { containerPort: number; protocol?: string }[]
  env?: { name: string; value: string }[]
  cpu_request?: string
  cpu_limit?: string
  memory_request?: string
  memory_limit?: string
  schedule?: string
}

export const k8sService = {
  // Cluster CRUD
  listClusters: (params: { page?: number; page_size?: number; env_code?: string; keyword?: string }) =>
    api.get<unknown, { data: PageData<Cluster> }>('/clusters', { params }),

  createCluster: (data: { name: string; code: string; api_server: string; kubeconfig: string; env_code?: string; description?: string }) =>
    api.post<unknown, { data: Cluster }>('/clusters', data),

  getCluster: (id: string) =>
    api.get<unknown, { data: Cluster }>(`/clusters/${id}`),

  updateCluster: (id: string, data: { name?: string; api_server?: string; kubeconfig?: string; env_code?: string; description?: string }) =>
    api.put<unknown, { data: Cluster }>(`/clusters/${id}`, data),

  deleteCluster: (id: string) =>
    api.delete(`/clusters/${id}`),

  // Connection test
  testConnection: (id: string) =>
    api.post<unknown, { data: ClusterOverview; message: string }>(`/clusters/${id}/test`),

  applyYaml: (id: string, data: { yaml: string; namespace?: string; dry_run?: boolean; action?: string }) =>
    api.post<unknown, { data: K8sApplyResult[]; message: string }>(`/clusters/${id}/apply`, data),

  formatYaml: (id: string, data: { yaml: string }) =>
    api.post<unknown, { data: string }>(`/clusters/${id}/format`, data),

  getYaml: (id: string, params: { kind: string; name: string; namespace?: string }) =>
    api.get<unknown, { data: string }>(`/clusters/${id}/yaml`, { params }),

  getYamlHistory: (id: string, params: { kind: string; name: string; namespace?: string; limit?: number }) =>
    api.get<unknown, { data: K8sYamlHistory[] }>(`/clusters/${id}/history`, { params }),

  // Cluster resources
  getOverview: (id: string) =>
    api.get<unknown, { data: ClusterOverview }>(`/clusters/${id}/overview`),

  getNodes: (id: string) =>
    api.get<unknown, { data: K8sNode[] }>(`/clusters/${id}/nodes`),

  getNamespaces: (id: string) =>
    api.get<unknown, { data: K8sNamespace[] }>(`/clusters/${id}/namespaces`),

  // Workloads
  getDeployments: (id: string, namespace?: string) =>
    api.get<unknown, { data: K8sResource[] }>(`/clusters/${id}/deployments`, { params: { namespace } }),

  getStatefulSets: (id: string, namespace?: string) =>
    api.get<unknown, { data: K8sResource[] }>(`/clusters/${id}/statefulsets`, { params: { namespace } }),

  getDaemonSets: (id: string, namespace?: string) =>
    api.get<unknown, { data: K8sResource[] }>(`/clusters/${id}/daemonsets`, { params: { namespace } }),

  getCronJobs: (id: string, namespace?: string) =>
    api.get<unknown, { data: K8sResource[] }>(`/clusters/${id}/cronjobs`, { params: { namespace } }),

  getPods: (id: string, namespace?: string) =>
    api.get<unknown, { data: K8sResource[] }>(`/clusters/${id}/pods`, { params: { namespace } }),

  // Pod logs
  getPodLogs: (id: string, params: { pod: string; namespace?: string; container?: string; tail?: number; previous?: boolean }) =>
    api.get<unknown, { data: string }>(`/clusters/${id}/pods/logs`, { params }),

  getPodContainers: (id: string, params: { pod: string; namespace?: string }) =>
    api.get<unknown, { data: string[] }>(`/clusters/${id}/pods/containers`, { params }),

  // Deployment operations
  createDeployment: (id: string, data: CreateWorkloadParams) =>
    api.post<unknown, { data: K8sResource }>(`/clusters/${id}/deployments`, data),

  scaleDeployment: (id: string, namespace: string, name: string, replicas: number) =>
    api.put(`/clusters/${id}/deployments/${name}/scale`, { namespace, replicas }),

  restartDeployment: (id: string, namespace: string, name: string) =>
    api.post(`/clusters/${id}/deployments/${name}/restart`, { namespace }),

  deleteDeployment: (id: string, namespace: string, name: string) =>
    api.delete(`/clusters/${id}/deployments/${name}`, { params: { namespace } }),

  // StatefulSet operations
  createStatefulSet: (id: string, data: CreateWorkloadParams) =>
    api.post<unknown, { data: K8sResource }>(`/clusters/${id}/statefulsets`, data),

  scaleStatefulSet: (id: string, namespace: string, name: string, replicas: number) =>
    api.put(`/clusters/${id}/statefulsets/${name}/scale`, { namespace, replicas }),

  deleteStatefulSet: (id: string, namespace: string, name: string) =>
    api.delete(`/clusters/${id}/statefulsets/${name}`, { params: { namespace } }),

  // DaemonSet operations
  createDaemonSet: (id: string, data: CreateWorkloadParams) =>
    api.post<unknown, { data: K8sResource }>(`/clusters/${id}/daemonsets`, data),

  deleteDaemonSet: (id: string, namespace: string, name: string) =>
    api.delete(`/clusters/${id}/daemonsets/${name}`, { params: { namespace } }),

  // CronJob operations
  createCronJob: (id: string, data: CreateWorkloadParams) =>
    api.post<unknown, { data: K8sResource }>(`/clusters/${id}/cronjobs`, data),

  deleteCronJob: (id: string, namespace: string, name: string) =>
    api.delete(`/clusters/${id}/cronjobs/${name}`, { params: { namespace } }),

  // Services
  getServices: (id: string, namespace?: string) =>
    api.get<unknown, { data: K8sResource[] }>(`/clusters/${id}/services`, { params: { namespace } }),

  createService: (id: string, data: { name: string; namespace: string; type: string; ports: { port: number; targetPort: number; protocol?: string; nodePort?: number }[]; selector: Record<string, string> }) =>
    api.post<unknown, { data: K8sResource }>(`/clusters/${id}/services`, data),

  deleteService: (id: string, namespace: string, name: string) =>
    api.delete(`/clusters/${id}/services/${name}`, { params: { namespace } }),

  // Ingresses
  getIngresses: (id: string, namespace?: string) =>
    api.get<unknown, { data: K8sIngress[] }>(`/clusters/${id}/ingresses`, { params: { namespace } }),

  createIngress: (id: string, data: { name: string; namespace: string; rules: { host: string; paths: { path: string; backend: string; port: number }[] }[] }) =>
    api.post<unknown, { data: K8sIngress }>(`/clusters/${id}/ingresses`, data),

  deleteIngress: (id: string, namespace: string, name: string) =>
    api.delete(`/clusters/${id}/ingresses/${name}`, { params: { namespace } }),

  // ConfigMaps
  getConfigMaps: (id: string, namespace?: string) =>
    api.get<unknown, { data: K8sConfigMap[] }>(`/clusters/${id}/configmaps`, { params: { namespace } }),

  createConfigMap: (id: string, data: { name: string; namespace: string; data: Record<string, string> }) =>
    api.post<unknown, { data: K8sConfigMap }>(`/clusters/${id}/configmaps`, data),

  updateConfigMap: (id: string, namespace: string, name: string, data: Record<string, string>) =>
    api.put<unknown, { data: K8sConfigMap }>(`/clusters/${id}/configmaps/${name}`, { namespace, data }),

  deleteConfigMap: (id: string, namespace: string, name: string) =>
    api.delete(`/clusters/${id}/configmaps/${name}`, { params: { namespace } }),

  // Secrets
  getSecrets: (id: string, namespace?: string) =>
    api.get<unknown, { data: K8sSecret[] }>(`/clusters/${id}/secrets`, { params: { namespace } }),

  createSecret: (id: string, data: { name: string; namespace: string; type: string; data: Record<string, string> }) =>
    api.post<unknown, { data: K8sSecret }>(`/clusters/${id}/secrets`, data),

  deleteSecret: (id: string, namespace: string, name: string) =>
    api.delete(`/clusters/${id}/secrets/${name}`, { params: { namespace } }),

  // Generic workload resource fetch (helper)
  getWorkloads: (id: string, kind: string, namespace?: string) => {
    const endpointMap: Record<string, string> = {
      Deployment: 'deployments',
      StatefulSet: 'statefulsets',
      DaemonSet: 'daemonsets',
      CronJob: 'cronjobs',
    }
    const endpoint = endpointMap[kind] || 'deployments'
    return api.get<unknown, { data: K8sResource[] }>(`/clusters/${id}/${endpoint}`, { params: { namespace } })
  },
}
