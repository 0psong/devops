import React, { Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Spin } from 'antd'
import { useAuthStore } from '@/stores/auth'
import MainLayout from '@/components/MainLayout'

// Lazy-loaded pages for code splitting
const Login = React.lazy(() => import('@/pages/Login'))
const Dashboard = React.lazy(() => import('@/pages/Dashboard'))
const HostList = React.lazy(() => import('@/pages/Monitor/HostList'))
const AppList = React.lazy(() => import('@/pages/Deploy/AppList'))
const AppDetail = React.lazy(() => import('@/pages/Deploy/AppDetail'))
const PipelineList = React.lazy(() => import('@/pages/Deploy/PipelineList'))
const VersionList = React.lazy(() => import('@/pages/Deploy/VersionList'))
const ConfigList = React.lazy(() => import('@/pages/Config/ConfigList'))
const UserList = React.lazy(() => import('@/pages/System/UserList'))
const GroupList = React.lazy(() => import('@/pages/System/GroupList'))
const RolePermissionList = React.lazy(() => import('@/pages/System/RolePermissionList'))
const AuditLogList = React.lazy(() => import('@/pages/System/AuditLogList'))
const ClusterList = React.lazy(() => import('@/pages/K8s/ClusterList'))
const ClusterDetail = React.lazy(() => import('@/pages/K8s/ClusterDetail'))
const WorkloadList = React.lazy(() => import('@/pages/K8s/WorkloadList'))
const PodList = React.lazy(() => import('@/pages/K8s/PodList'))
const ServiceList = React.lazy(() => import('@/pages/K8s/ServiceList'))
const IngressList = React.lazy(() => import('@/pages/K8s/IngressList'))
const ConfigMapList = React.lazy(() => import('@/pages/K8s/ConfigMapList'))
const SecretList = React.lazy(() => import('@/pages/K8s/SecretList'))
// Cloud
const AccountList = React.lazy(() => import('@/pages/Cloud/AccountList'))
const InstanceList = React.lazy(() => import('@/pages/Cloud/InstanceList'))
const NodePoolList = React.lazy(() => import('@/pages/Cloud/NodePoolList'))
// Pipeline V2
const DefinitionList = React.lazy(() => import('@/pages/Pipeline/DefinitionList'))
const RunDetail = React.lazy(() => import('@/pages/Pipeline/RunDetail'))
const ArtifactList = React.lazy(() => import('@/pages/Pipeline/ArtifactList'))
const ApprovalList = React.lazy(() => import('@/pages/Pipeline/ApprovalList'))
const PlaceholderPage = React.lazy(() => import('@/pages/Placeholder'))

const ServiceCatalogPage = () => (
  <PlaceholderPage
    title="服务列表"
    description="统一管理业务服务、负责人、环境、仓库和关联资源。"
    items={['收银台服务', 'POS 网关', '支付网关', '管理后台']}
  />
)

const PageLoading = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
    <Spin size="large" />
  </div>
)

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated())
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function App() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <PrivateRoute>
              <MainLayout>
                <Suspense fallback={<PageLoading />}>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/service-catalog/services" element={<ServiceCatalogPage />} />
                    <Route
                      path="/service-catalog/dependencies"
                      element={
                        <PlaceholderPage
                          title="依赖关系"
                          description="梳理服务之间的调用、数据和资源依赖，帮助定位变更影响面。"
                          items={['服务调用拓扑', '上下游依赖', '变更影响分析', '负责人关联']}
                        />
                      }
                    />
                    <Route
                      path="/service-catalog/docs"
                      element={
                        <PlaceholderPage
                          title="文档与 Runbook"
                          description="集中沉淀服务文档、应急预案和常用运维操作手册。"
                          items={['服务文档', '应急预案', '操作手册', '故障复盘链接']}
                        />
                      }
                    />
                    <Route path="/monitor/hosts" element={<HostList />} />
                    <Route path="/deploy/apps" element={<AppList />} />
                    <Route path="/deploy/apps/:id" element={<AppDetail />} />
                    <Route path="/deploy/pipelines" element={<PipelineList />} />
                    <Route
                      path="/delivery/releases"
                      element={
                        <PlaceholderPage
                          title="发布单"
                          description="以发布单串联版本、审批、灰度、回滚和上线窗口。"
                          items={['发布计划', '风险检查', '灰度策略', '回滚记录']}
                        />
                      }
                    />
                    <Route path="/deploy/versions" element={<VersionList />} />
                    {/* K8s - Cluster */}
                    <Route path="/k8s/clusters" element={<ClusterList />} />
                    <Route path="/k8s/clusters/:id" element={<ClusterDetail />} />
                    {/* K8s - Workloads */}
                    <Route path="/k8s/workloads/deployments" element={<WorkloadList kind="Deployment" />} />
                    <Route path="/k8s/workloads/statefulsets" element={<WorkloadList kind="StatefulSet" />} />
                    <Route path="/k8s/workloads/daemonsets" element={<WorkloadList kind="DaemonSet" />} />
                    <Route path="/k8s/workloads/cronjobs" element={<WorkloadList kind="CronJob" />} />
                    <Route path="/k8s/workloads/pods" element={<PodList />} />
                    {/* K8s - Network */}
                    <Route path="/k8s/network/services" element={<ServiceList />} />
                    <Route path="/k8s/network/ingresses" element={<IngressList />} />
                    {/* K8s - Config */}
                    <Route path="/k8s/config/configmaps" element={<ConfigMapList />} />
                    <Route path="/k8s/config/secrets" element={<SecretList />} />
                    {/* Cloud */}
                    <Route path="/cloud/accounts" element={<AccountList />} />
                    <Route path="/cloud/instances" element={<InstanceList />} />
                    <Route path="/cloud/nodepools" element={<NodePoolList />} />
                    {/* Pipeline V2 */}
                    <Route path="/pipeline/definitions" element={<DefinitionList />} />
                    <Route path="/pipeline/runs/:id" element={<RunDetail />} />
                    <Route path="/pipeline/artifacts" element={<ArtifactList />} />
                    <Route path="/pipeline/approvals" element={<ApprovalList />} />
                    <Route
                      path="/observability/alerts"
                      element={
                        <PlaceholderPage
                          title="告警中心"
                          description="统一接入主机、应用、Kubernetes 和云资源告警，支持分级处理。"
                          items={['告警列表', '告警规则', '通知渠道', '静默与收敛']}
                        />
                      }
                    />
                    <Route
                      path="/observability/events"
                      element={
                        <PlaceholderPage
                          title="事件中心"
                          description="汇总发布、配置、资源和告警事件，形成可追踪的运维时间线。"
                          items={['事件时间线', '影响范围', '处理状态', '关联审计']}
                        />
                      }
                    />
                    <Route
                      path="/observability/logs"
                      element={
                        <PlaceholderPage
                          title="日志查询"
                          description="面向服务和资源的统一日志检索入口，便于排障和审计。"
                          items={['服务日志', '主机日志', 'K8s 日志', '查询模板']}
                        />
                      }
                    />
                    <Route
                      path="/observability/metrics"
                      element={
                        <PlaceholderPage
                          title="指标监控"
                          description="集中查看服务、主机、集群和云资源的核心运行指标。"
                          items={['指标大盘', 'SLO 看板', '资源趋势', '容量预警']}
                        />
                      }
                    />
                    {/* Legacy redirects */}
                    <Route path="/k8s/services" element={<Navigate to="/k8s/network/services" replace />} />
                    <Route path="/k8s/pods" element={<Navigate to="/k8s/workloads/pods" replace />} />
                    <Route path="/config" element={<ConfigList />} />
                    <Route path="/system/users" element={<UserList />} />
                    <Route path="/system/groups" element={<GroupList />} />
                    <Route path="/system/roles" element={<RolePermissionList />} />
                    <Route path="/system/audit-logs" element={<AuditLogList />} />
                    <Route
                      path="/governance/settings"
                      element={
                        <PlaceholderPage
                          title="平台设置"
                          description="管理平台级策略、集成、通知和操作安全规则。"
                          items={['登录策略', '通知集成', '审批策略', '标签规范']}
                        />
                      }
                    />
                  </Routes>
                </Suspense>
              </MainLayout>
            </PrivateRoute>
          }
        />
      </Routes>
    </Suspense>
  )
}

export default App
