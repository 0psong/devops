import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Layout,
  Menu,
  Dropdown,
  Avatar,
  Space,
  Badge,
  Breadcrumb,
} from 'antd'
import {
  DashboardOutlined,
  DesktopOutlined,
  CloudServerOutlined,
  ClusterOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  TeamOutlined,
  BellOutlined,
  DeploymentUnitOutlined,
  ApiOutlined,
  ContainerOutlined,
  BranchesOutlined,
  TagsOutlined,
  DatabaseOutlined,
  HddOutlined,
  FieldTimeOutlined,
  GatewayOutlined,
  FileTextOutlined,
  LockOutlined,
  AuditOutlined,
  UsergroupAddOutlined,
  SafetyOutlined,
  InboxOutlined,
  CheckSquareOutlined,
  AppstoreOutlined,
  AlertOutlined,
  FileSearchOutlined,
  LineChartOutlined,
  ScheduleOutlined,
  ControlOutlined,
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { useAuthStore } from '@/stores/auth'

const { Header, Content } = Layout

interface MainLayoutProps {
  children: React.ReactNode
}

const MIN_WIDTH = 160
const MAX_WIDTH = 360
const DEFAULT_WIDTH = 220

const menuItems: MenuProps['items'] = [
  {
    key: '/dashboard',
    icon: <DashboardOutlined />,
    label: '概览',
  },
  {
    key: '/service-catalog',
    icon: <AppstoreOutlined />,
    label: '服务目录',
    children: [
      { key: '/service-catalog/services', label: '服务列表', icon: <AppstoreOutlined /> },
      { key: '/service-catalog/dependencies', label: '依赖关系', icon: <GatewayOutlined /> },
      { key: '/service-catalog/docs', label: '文档与 Runbook', icon: <FileTextOutlined /> },
    ],
  },
  {
    key: '/delivery',
    icon: <BranchesOutlined />,
    label: '发布交付',
    children: [
      { key: '/pipeline/definitions', label: '流水线定义', icon: <BranchesOutlined /> },
      { key: '/deploy/pipelines', label: '流水线运行', icon: <DeploymentUnitOutlined /> },
      { key: '/delivery/releases', label: '发布单', icon: <ScheduleOutlined /> },
      { key: '/deploy/versions', label: '版本管理', icon: <TagsOutlined /> },
      { key: '/pipeline/artifacts', label: '制品管理', icon: <InboxOutlined /> },
      { key: '/pipeline/approvals', label: '发布审批', icon: <CheckSquareOutlined /> },
    ],
  },
  {
    key: '/resources',
    icon: <CloudServerOutlined />,
    label: '资源运维',
    children: [
      { key: '/monitor/hosts', label: '主机管理', icon: <DesktopOutlined /> },
      { key: '/cloud/accounts', label: '云账号', icon: <SafetyOutlined /> },
      { key: '/cloud/instances', label: '云实例', icon: <CloudServerOutlined /> },
      { key: '/cloud/nodepools', label: '节点池', icon: <ClusterOutlined /> },
      { key: '/k8s/clusters', label: 'K8s 集群', icon: <ClusterOutlined /> },
      {
        type: 'group',
        label: 'Kubernetes 资源',
        children: [
          { key: '/k8s/workloads/deployments', label: '无状态', icon: <DeploymentUnitOutlined /> },
          { key: '/k8s/workloads/statefulsets', label: '有状态', icon: <DatabaseOutlined /> },
          { key: '/k8s/workloads/daemonsets', label: '守护进程集', icon: <HddOutlined /> },
          { key: '/k8s/workloads/cronjobs', label: '任务', icon: <FieldTimeOutlined /> },
          { key: '/k8s/workloads/pods', label: '容器组', icon: <ContainerOutlined /> },
        ],
      },
      {
        type: 'group',
        label: '网络与配置',
        children: [
          { key: '/k8s/network/services', label: '服务', icon: <ApiOutlined /> },
          { key: '/k8s/network/ingresses', label: '路由', icon: <GatewayOutlined /> },
          { key: '/k8s/config/configmaps', label: '配置项', icon: <FileTextOutlined /> },
          { key: '/k8s/config/secrets', label: '保密字典', icon: <LockOutlined /> },
          { key: '/config', label: '配置中心', icon: <SettingOutlined /> },
        ],
      },
    ],
  },
  {
    key: '/observability',
    icon: <AlertOutlined />,
    label: '观测告警',
    children: [
      { key: '/observability/alerts', label: '告警中心', icon: <AlertOutlined /> },
      { key: '/observability/events', label: '事件中心', icon: <FileSearchOutlined /> },
      { key: '/observability/logs', label: '日志查询', icon: <FileTextOutlined /> },
      { key: '/observability/metrics', label: '指标监控', icon: <LineChartOutlined /> },
    ],
  },
  {
    key: '/governance',
    icon: <TeamOutlined />,
    label: '系统治理',
    children: [
      { key: '/system/users', label: '用户管理', icon: <UserOutlined /> },
      { key: '/system/groups', label: '用户分组', icon: <UsergroupAddOutlined /> },
      { key: '/system/roles', label: '角色权限', icon: <SafetyOutlined /> },
      { key: '/system/audit-logs', label: '审计日志', icon: <AuditOutlined /> },
      { key: '/governance/settings', label: '平台设置', icon: <ControlOutlined /> },
    ],
  },
]

const breadcrumbMap: Record<string, string> = {
  '/dashboard': '概览',
  '/service-catalog': '服务目录',
  '/service-catalog/services': '服务列表',
  '/service-catalog/dependencies': '依赖关系',
  '/service-catalog/docs': '文档与 Runbook',
  '/monitor': '监控中心',
  '/monitor/hosts': '主机管理',
  '/delivery': '发布交付',
  '/delivery/releases': '发布单',
  '/deploy': '发布交付',
  '/deploy/apps': '应用管理',
  '/deploy/pipelines': '流水线运行',
  '/deploy/versions': '版本管理',
  '/resources': '资源运维',
  '/k8s': 'Kubernetes',
  '/k8s/clusters': '集群管理',
  '/k8s/workloads': '工作负载',
  '/k8s/workloads/deployments': '无状态',
  '/k8s/workloads/statefulsets': '有状态',
  '/k8s/workloads/daemonsets': '守护进程集',
  '/k8s/workloads/cronjobs': '任务',
  '/k8s/workloads/pods': '容器组',
  '/k8s/network': '网络',
  '/k8s/network/services': '服务',
  '/k8s/network/ingresses': '路由',
  '/k8s/config': '配置管理',
  '/k8s/config/configmaps': '配置项',
  '/k8s/config/secrets': '保密字典',
  '/cloud': '云资源管理',
  '/cloud/accounts': '云账号',
  '/cloud/instances': '云实例',
  '/cloud/nodepools': '节点池',
  '/pipeline': '发布交付',
  '/pipeline/definitions': '流水线定义',
  '/pipeline/runs': '运行详情',
  '/pipeline/artifacts': '制品管理',
  '/pipeline/approvals': '发布审批',
  '/observability': '观测告警',
  '/observability/alerts': '告警中心',
  '/observability/events': '事件中心',
  '/observability/logs': '日志查询',
  '/observability/metrics': '指标监控',
  '/config': '配置中心',
  '/governance': '系统治理',
  '/governance/settings': '平台设置',
  '/system': '系统治理',
  '/system/users': '用户管理',
  '/system/groups': '用户分组',
  '/system/roles': '角色权限',
  '/system/audit-logs': '审计日志',
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [siderWidth, setSiderWidth] = useState(DEFAULT_WIDTH)
  const [collapsed, setCollapsed] = useState(false)
  const widthBeforeCollapse = useRef(DEFAULT_WIDTH)
  const dragging = useRef(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX))
      setSiderWidth(newWidth)
      setCollapsed(false)
      widthBeforeCollapse.current = newWidth
    }
    const onMouseUp = () => {
      if (!dragging.current) return
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  const toggleCollapse = () => {
    if (collapsed) {
      setCollapsed(false)
      setSiderWidth(widthBeforeCollapse.current)
    } else {
      widthBeforeCollapse.current = siderWidth
      setCollapsed(true)
      setSiderWidth(64)
    }
  }

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key)
  }

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人信息',
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
      onClick: () => {
        logout()
        navigate('/login')
      },
    },
  ]

  const getSelectedKeys = () => {
    const path = location.pathname
    if (path.startsWith('/deploy/apps/')) return ['/service-catalog/services']
    if (path.startsWith('/deploy/pipelines/')) return ['/deploy/pipelines']
    if (path.startsWith('/k8s/clusters/')) return ['/k8s/clusters']
    if (path.startsWith('/pipeline/runs/')) return ['/pipeline/definitions']
    if (path.startsWith('/pipeline/definitions/')) return ['/pipeline/definitions']
    return [path]
  }

  const getOpenKeys = () => {
    const path = location.pathname
    if (path.startsWith('/service-catalog') || path.startsWith('/deploy/apps')) return ['/service-catalog']
    if (path.startsWith('/delivery') || path.startsWith('/deploy/pipelines') || path.startsWith('/deploy/versions') || path.startsWith('/pipeline')) return ['/delivery']
    if (path.startsWith('/resources') || path.startsWith('/monitor') || path.startsWith('/k8s') || path.startsWith('/cloud') || path.startsWith('/config')) return ['/resources']
    if (path.startsWith('/observability')) return ['/observability']
    if (path.startsWith('/governance') || path.startsWith('/system')) return ['/governance']
    return []
  }

  const getBreadcrumbs = () => {
    const path = location.pathname
    const parts = path.split('/').filter(Boolean)
    const items: { title: string }[] = []

    let current = ''
    for (const part of parts) {
      current += `/${part}`
      const label = breadcrumbMap[current]
      if (label) {
        items.push({ title: label })
      }
    }

    if (items.length === 0) {
      items.push({ title: '仪表盘' })
    }

    return items
  }

  const actualWidth = collapsed ? 64 : siderWidth

  return (
    <Layout className="app-shell" style={{ minHeight: '100vh' }}>
      <div
        className="app-sider"
        style={{
          width: actualWidth,
          minWidth: actualWidth,
          maxWidth: actualWidth,
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: dragging.current ? 'none' : 'width 0.2s, min-width 0.2s, max-width 0.2s',
          boxShadow: '6px 0 24px rgba(15, 23, 42, 0.12)',
        }}
      >
        <div className="sidebar-logo">
          <span style={{ fontSize: collapsed ? 18 : 20, fontWeight: 700, letterSpacing: collapsed ? 0 : 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {collapsed ? 'D' : 'DevOps'}
          </span>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          <Menu
            theme="dark"
            mode="inline"
            inlineCollapsed={collapsed}
            selectedKeys={getSelectedKeys()}
            defaultOpenKeys={getOpenKeys()}
            items={menuItems}
            onClick={handleMenuClick}
            style={{ background: 'transparent', borderRight: 'none' }}
          />
        </div>
        {/* Drag handle */}
        {!collapsed && (
          <div
            onMouseDown={handleMouseDown}
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: 4,
              cursor: 'col-resize',
              zIndex: 11,
              background: 'transparent',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(14, 165, 233, 0.35)' }}
            onMouseLeave={(e) => { if (!dragging.current) e.currentTarget.style.background = 'transparent' }}
          />
        )}
      </div>
      <Layout style={{ marginLeft: actualWidth, transition: dragging.current ? 'none' : 'margin-left 0.2s', overflow: 'hidden' }}>
        <Header
          className="app-header"
          style={{
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 64,
          }}
        >
          <Space size={16} align="center">
            <span className="header-trigger" onClick={toggleCollapse}>
              {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </span>
            <Breadcrumb items={getBreadcrumbs()} />
          </Space>
          <Space size={20}>
            <Badge count={0} size="small">
              <BellOutlined style={{ fontSize: 18, color: '#334155', cursor: 'pointer' }} />
            </Badge>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar
                  size={32}
                  style={{ background: '#0ea5e9' }}
                  icon={<UserOutlined />}
                />
                <span style={{ fontWeight: 600, color: '#0f172a' }}>
                  {user?.real_name || user?.username}
                </span>
              </Space>
            </Dropdown>
          </Space>
        </Header>
        <Content
          className="app-content"
          style={{ borderRadius: 0 }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  )
}

export default MainLayout
