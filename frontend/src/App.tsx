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
                    <Route path="/monitor/hosts" element={<HostList />} />
                    <Route path="/deploy/apps" element={<AppList />} />
                    <Route path="/deploy/apps/:id" element={<AppDetail />} />
                    <Route path="/deploy/pipelines" element={<PipelineList />} />
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
                    {/* Legacy redirects */}
                    <Route path="/k8s/services" element={<Navigate to="/k8s/network/services" replace />} />
                    <Route path="/k8s/pods" element={<Navigate to="/k8s/workloads/pods" replace />} />
                    <Route path="/config" element={<ConfigList />} />
                    <Route path="/system/users" element={<UserList />} />
                    <Route path="/system/groups" element={<GroupList />} />
                    <Route path="/system/roles" element={<RolePermissionList />} />
                    <Route path="/system/audit-logs" element={<AuditLogList />} />
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
