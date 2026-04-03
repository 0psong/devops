import api, { PageData } from './api'

export interface PipelineStage {
  id: string
  pipeline_id: string
  name: string
  status: string
  sort: number
  duration: number
  log: string
  started_at: string
  finished_at: string
}

export interface Pipeline {
  id: string
  name: string
  app_id: string
  app?: { id: string; name: string; code: string }
  branch: string
  status: string
  trigger: string
  stages: PipelineStage[]
  duration: number
  created_by: string
  started_at: string
  finished_at: string
  created_at: string
}

export const pipelineService = {
  list: (params: { page?: number; page_size?: number; app_id?: string; status?: string }) =>
    api.get<unknown, { data: PageData<Pipeline> }>('/pipelines', { params }),

  create: (data: { name: string; app_id: string; branch?: string; trigger?: string }) =>
    api.post<unknown, { data: Pipeline }>('/pipelines', data),

  get: (id: string) =>
    api.get<unknown, { data: Pipeline }>(`/pipelines/${id}`),

  delete: (id: string) =>
    api.delete(`/pipelines/${id}`),

  run: (id: string) =>
    api.post<unknown, { data: Pipeline }>(`/pipelines/${id}/run`),

  cancel: (id: string) =>
    api.post<unknown, { data: Pipeline }>(`/pipelines/${id}/cancel`),
}
