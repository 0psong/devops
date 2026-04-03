import api, { PageData } from './api'

export interface CloudAccount {
  id: string
  name: string
  provider: string
  region: string
  status: number
  description: string
  created_by: string
  created_at: string
}

export interface CloudInstance {
  id: string
  account_id: string
  account?: CloudAccount
  instance_id: string
  name: string
  provider: string
  region: string
  zone: string
  instance_type: string
  image_id: string
  cpu: number
  memory: number
  public_ip: string
  private_ip: string
  status: string
  host_id?: string
  host?: { id: string; name: string; ip: string }
  cluster_id?: string
  node_pool_id?: string
  expire_at?: string
  charge_type: string
  created_at: string
}

export interface NodePool {
  id: string
  cluster_id: string
  cluster?: { id: string; name: string; code: string }
  account_id: string
  account?: CloudAccount
  name: string
  instance_type: string
  image_id: string
  min_size: number
  max_size: number
  desired_size: number
  current_size: number
  status: string
  description: string
  created_at: string
}

export interface Region { id: string; name: string }
export interface Zone { id: string; name: string; region_id: string }
export interface InstanceTypeInfo { id: string; name: string; cpu: number; memory: number }
export interface Image { id: string; name: string; os: string }

export const cloudService = {
  // 云账号
  listAccounts: (params: { page?: number; page_size?: number; provider?: string; keyword?: string }) =>
    api.get<unknown, { data: PageData<CloudAccount> }>('/cloud/accounts', { params }),
  createAccount: (data: { name: string; provider: string; access_key: string; secret_key: string; region?: string; description?: string }) =>
    api.post<unknown, { data: CloudAccount }>('/cloud/accounts', data),
  getAccount: (id: string) =>
    api.get<unknown, { data: CloudAccount }>(`/cloud/accounts/${id}`),
  updateAccount: (id: string, data: Partial<{ name: string; access_key: string; secret_key: string; region: string; description: string }>) =>
    api.put<unknown, { data: CloudAccount }>(`/cloud/accounts/${id}`, data),
  deleteAccount: (id: string) =>
    api.delete(`/cloud/accounts/${id}`),
  verifyAccount: (id: string) =>
    api.post(`/cloud/accounts/${id}/verify`),

  // 云资源查询
  listRegions: (accountId: string) =>
    api.get<unknown, { data: Region[] }>(`/cloud/accounts/${accountId}/regions`),
  listZones: (accountId: string, region: string) =>
    api.get<unknown, { data: Zone[] }>(`/cloud/accounts/${accountId}/zones`, { params: { region } }),
  listInstanceTypes: (accountId: string, region: string) =>
    api.get<unknown, { data: InstanceTypeInfo[] }>(`/cloud/accounts/${accountId}/instance-types`, { params: { region } }),
  listImages: (accountId: string, region: string) =>
    api.get<unknown, { data: Image[] }>(`/cloud/accounts/${accountId}/images`, { params: { region } }),

  // 云实例
  listInstances: (params: { page?: number; page_size?: number; account_id?: string; status?: string; cluster_id?: string }) =>
    api.get<unknown, { data: PageData<CloudInstance> }>('/cloud/instances', { params }),
  createInstance: (data: { account_id: string; name: string; region: string; zone?: string; instance_type: string; image_id: string; charge_type?: string }) =>
    api.post<unknown, { data: CloudInstance }>('/cloud/instances', data),
  getInstance: (id: string) =>
    api.get<unknown, { data: CloudInstance }>(`/cloud/instances/${id}`),
  startInstance: (id: string) =>
    api.post<unknown, { data: CloudInstance }>(`/cloud/instances/${id}/start`),
  stopInstance: (id: string) =>
    api.post<unknown, { data: CloudInstance }>(`/cloud/instances/${id}/stop`),
  terminateInstance: (id: string) =>
    api.post<unknown, { data: CloudInstance }>(`/cloud/instances/${id}/terminate`),
  syncInstance: (id: string) =>
    api.post<unknown, { data: CloudInstance }>(`/cloud/instances/${id}/sync`),
  bindHost: (id: string) =>
    api.post<unknown, { data: CloudInstance }>(`/cloud/instances/${id}/bindhost`),
  unbindHost: (id: string) =>
    api.post<unknown, { data: CloudInstance }>(`/cloud/instances/${id}/unbindhost`),

  // 节点池
  listNodePools: (params: { page?: number; page_size?: number; cluster_id?: string }) =>
    api.get<unknown, { data: PageData<NodePool> }>('/cloud/nodepools', { params }),
  createNodePool: (data: { cluster_id: string; account_id: string; name: string; instance_type?: string; image_id?: string; min_size?: number; max_size?: number; desired_size?: number; description?: string }) =>
    api.post<unknown, { data: NodePool }>('/cloud/nodepools', data),
  getNodePool: (id: string) =>
    api.get<unknown, { data: NodePool }>(`/cloud/nodepools/${id}`),
  updateNodePool: (id: string, data: Partial<{ name: string; min_size: number; max_size: number; desired_size: number; description: string }>) =>
    api.put<unknown, { data: NodePool }>(`/cloud/nodepools/${id}`, data),
  deleteNodePool: (id: string) =>
    api.delete(`/cloud/nodepools/${id}`),
  scaleNodePool: (id: string, desired_size: number) =>
    api.post<unknown, { data: NodePool }>(`/cloud/nodepools/${id}/scale`, { desired_size }),
}
