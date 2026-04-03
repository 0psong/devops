import api, { PageData } from './api'

export interface AppVersion {
  id: string
  app_id: string
  app?: { id: string; name: string; code: string }
  version: string
  branch: string
  commit_id: string
  commit_msg: string
  changelog: string
  build_status: string
  is_current: boolean
  deploy_count: number
  created_by: string
  created_at: string
}

export const versionService = {
  list: (params: { page?: number; page_size?: number; app_id?: string; keyword?: string }) =>
    api.get<unknown, { data: PageData<AppVersion> }>('/versions', { params }),

  create: (data: { app_id: string; version: string; branch?: string; commit_id?: string; commit_msg?: string; changelog?: string }) =>
    api.post<unknown, { data: AppVersion }>('/versions', data),

  get: (id: string) =>
    api.get<unknown, { data: AppVersion }>(`/versions/${id}`),

  update: (id: string, data: { build_status?: string; changelog?: string }) =>
    api.put<unknown, { data: AppVersion }>(`/versions/${id}`, data),

  delete: (id: string) =>
    api.delete(`/versions/${id}`),

  deploy: (id: string) =>
    api.post<unknown, { data: AppVersion }>(`/versions/${id}/deploy`),

  rollback: (id: string) =>
    api.post<unknown, { data: AppVersion }>(`/versions/${id}/rollback`),
}
