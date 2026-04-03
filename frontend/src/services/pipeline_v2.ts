import api, { PageData } from './api'

export interface PipelineDefinition {
  id: string
  name: string
  app_id: string
  app?: { id: string; name: string; code: string }
  description: string
  config: string
  env_vars: string
  trigger_type: string
  trigger_config: string
  enabled: boolean
  created_by: string
  created_at: string
}

export interface StepRun {
  id: string
  stage_run_id: string
  name: string
  type: string
  config: string
  sort: number
  status: string
  log: string
  duration: number
  started_at: string
  finished_at: string
}

export interface StageRun {
  id: string
  pipeline_run_id: string
  name: string
  type: string
  env_code: string
  sort: number
  status: string
  duration: number
  steps: StepRun[]
  started_at: string
  finished_at: string
}

export interface PipelineRun {
  id: string
  definition_id: string
  definition?: PipelineDefinition
  run_number: number
  status: string
  branch: string
  commit_id: string
  commit_msg: string
  env_vars: string
  duration: number
  trigger_type: string
  trigger_by: string
  stages: StageRun[]
  started_at: string
  finished_at: string
  created_at: string
}

export interface Artifact {
  id: string
  pipeline_run_id: string
  app_id: string
  app?: { id: string; name: string; code: string }
  name: string
  type: string
  version: string
  size: number
  registry: string
  path: string
  digest: string
  metadata: string
  created_by: string
  created_at: string
}

export const pipelineV2Service = {
  // 流水线定义
  listDefinitions: (params: { page?: number; page_size?: number; app_id?: string; keyword?: string }) =>
    api.get<unknown, { data: PageData<PipelineDefinition> }>('/pipeline-defs', { params }),
  createDefinition: (data: { name: string; app_id: string; description?: string; config?: string; env_vars?: string; trigger_type?: string; trigger_config?: string }) =>
    api.post<unknown, { data: PipelineDefinition }>('/pipeline-defs', data),
  getDefinition: (id: string) =>
    api.get<unknown, { data: PipelineDefinition }>(`/pipeline-defs/${id}`),
  updateDefinition: (id: string, data: Partial<{ name: string; description: string; config: string; env_vars: string; trigger_type: string; trigger_config: string; enabled: boolean }>) =>
    api.put<unknown, { data: PipelineDefinition }>(`/pipeline-defs/${id}`, data),
  deleteDefinition: (id: string) =>
    api.delete(`/pipeline-defs/${id}`),
  triggerRun: (id: string, data: { branch?: string; commit_id?: string; env_vars?: string }) =>
    api.post<unknown, { data: PipelineRun }>(`/pipeline-defs/${id}/trigger`, data),

  // 流水线运行
  listRuns: (params: { page?: number; page_size?: number; definition_id?: string; status?: string }) =>
    api.get<unknown, { data: PageData<PipelineRun> }>('/pipeline-runs', { params }),
  getRun: (id: string) =>
    api.get<unknown, { data: PipelineRun }>(`/pipeline-runs/${id}`),
  cancelRun: (id: string) =>
    api.post<unknown, { data: PipelineRun }>(`/pipeline-runs/${id}/cancel`),
  retryRun: (id: string) =>
    api.post<unknown, { data: PipelineRun }>(`/pipeline-runs/${id}/retry`),
  getStages: (runId: string) =>
    api.get<unknown, { data: StageRun[] }>(`/pipeline-runs/${runId}/stages`),
  getStepLog: (runId: string, stepId: string) =>
    api.get<unknown, { data: { log: string } }>(`/pipeline-runs/${runId}/steps/${stepId}/log`),

  // 审批
  approveRun: (runId: string, comment?: string) =>
    api.post(`/pipeline-runs/${runId}/approve`, { comment }),
  rejectRun: (runId: string, comment?: string) =>
    api.post(`/pipeline-runs/${runId}/reject`, { comment }),
  listPendingApprovals: (params?: { page?: number; page_size?: number }) =>
    api.get<unknown, { data: PageData<PipelineRun> }>('/approvals/pending', { params }),

  // 制品
  listArtifacts: (params: { page?: number; page_size?: number; app_id?: string; pipeline_run_id?: string }) =>
    api.get<unknown, { data: PageData<Artifact> }>('/artifacts', { params }),
  createArtifact: (data: { app_id: string; name: string; type?: string; version?: string; size?: number; registry?: string; path?: string; digest?: string; metadata?: string; pipeline_run_id?: string }) =>
    api.post<unknown, { data: Artifact }>('/artifacts', data),
  getArtifact: (id: string) =>
    api.get<unknown, { data: Artifact }>(`/artifacts/${id}`),
  deleteArtifact: (id: string) =>
    api.delete(`/artifacts/${id}`),
}
