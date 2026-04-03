import api from './api'

export interface DashboardStats {
  host_total: number
  host_online: number
  app_total: number
  deploy_total: number
  deploy_today: number
  cluster_total: number
  alert_total: number
  config_total: number
}

export interface DashboardActivity {
  title: string
  type: string
  created_at: string
}

export interface DeployTrend {
  date: string
  count: number
}

export const dashboardService = {
  getStats: () =>
    api.get<unknown, { data: DashboardStats }>('/dashboard/stats'),

  getActivities: (limit = 10) =>
    api.get<unknown, { data: DashboardActivity[] }>('/dashboard/activities', { params: { limit } }),

  getDeployTrend: (days = 7) =>
    api.get<unknown, { data: DeployTrend[] }>('/dashboard/deploy-trend', { params: { days } }),
}
