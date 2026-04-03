import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card,
  Statistic,
  Table,
  Tag,
  Tabs,
  Select,
  Button,
  Descriptions,
  Spin,
  message,
} from 'antd'
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClusterOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  k8sService,
  Cluster,
  ClusterOverview,
  K8sNode,
  K8sNamespace,
  K8sResource,
} from '@/services/k8s'

const ClusterDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [cluster, setCluster] = useState<Cluster | null>(null)
  const [overview, setOverview] = useState<ClusterOverview | null>(null)
  const [nodes, setNodes] = useState<K8sNode[]>([])
  const [namespaces, setNamespaces] = useState<K8sNamespace[]>([])
  const [deployments, setDeployments] = useState<K8sResource[]>([])
  const [pods, setPods] = useState<K8sResource[]>([])
  const [services, setServices] = useState<K8sResource[]>([])
  const [selectedNs, setSelectedNs] = useState<string>('')
  const [activeTab, setActiveTab] = useState('overview')

  const fetchCluster = async () => {
    if (!id) return
    try {
      const res = await k8sService.getCluster(id)
      setCluster(res.data)
    } catch {
      message.error('获取集群信息失败')
    }
  }

  const fetchOverview = async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await k8sService.getOverview(id)
      setOverview(res.data)
    } catch {
      message.error('获取集群概览失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchNodes = async () => {
    if (!id) return
    try {
      const res = await k8sService.getNodes(id)
      setNodes(res.data || [])
    } catch {
      message.error('获取节点列表失败')
    }
  }

  const fetchNamespaces = async () => {
    if (!id) return
    try {
      const res = await k8sService.getNamespaces(id)
      setNamespaces(res.data || [])
    } catch {
      message.error('获取命名空间失败')
    }
  }

  const fetchDeployments = async () => {
    if (!id) return
    try {
      const res = await k8sService.getDeployments(id, selectedNs)
      setDeployments(res.data || [])
    } catch {
      message.error('获取 Deployments 失败')
    }
  }

  const fetchPods = async () => {
    if (!id) return
    try {
      const res = await k8sService.getPods(id, selectedNs)
      setPods(res.data || [])
    } catch {
      message.error('获取 Pods 失败')
    }
  }

  const fetchServices = async () => {
    if (!id) return
    try {
      const res = await k8sService.getServices(id, selectedNs)
      setServices(res.data || [])
    } catch {
      message.error('获取 Services 失败')
    }
  }

  useEffect(() => {
    fetchCluster()
    fetchOverview()
    fetchNamespaces()
  }, [id])

  useEffect(() => {
    if (activeTab === 'nodes') fetchNodes()
    if (activeTab === 'deployments') fetchDeployments()
    if (activeTab === 'pods') fetchPods()
    if (activeTab === 'services') fetchServices()
  }, [activeTab, selectedNs])

  const nodeColumns: ColumnsType<K8sNode> = [
    { title: '节点名称', dataIndex: 'name', key: 'name', width: 200 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (s: string) => (
        <Tag color={s === 'Ready' ? 'green' : 'red'} icon={s === 'Ready' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}>
          {s}
        </Tag>
      ),
    },
    {
      title: '角色',
      dataIndex: 'roles',
      key: 'roles',
      width: 150,
      render: (roles: string[]) => roles?.map((r) => <Tag key={r} color="blue">{r}</Tag>),
    },
    { title: '内部 IP', dataIndex: 'internal_ip', key: 'internal_ip', width: 140 },
    { title: 'CPU', dataIndex: 'cpu_capacity', key: 'cpu_capacity', width: 80 },
    { title: '内存', dataIndex: 'memory_capacity', key: 'memory_capacity', width: 100 },
    { title: 'Kubelet', dataIndex: 'kubelet_version', key: 'kubelet_version', width: 120 },
    { title: '容器运行时', dataIndex: 'container_runtime', key: 'container_runtime', width: 160 },
    { title: '系统', dataIndex: 'os_image', key: 'os_image', ellipsis: true },
  ]

  const deploymentColumns: ColumnsType<K8sResource> = [
    { title: '名称', dataIndex: 'name', key: 'name', width: 200 },
    { title: '命名空间', dataIndex: 'namespace', key: 'namespace', width: 120 },
    {
      title: '副本',
      key: 'replicas',
      width: 100,
      render: (_, r) => (
        <span style={{ color: r.ready === r.replicas ? '#52c41a' : '#faad14' }}>
          {r.ready}/{r.replicas}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: string) => {
        const colorMap: Record<string, string> = { Running: 'green', Progressing: 'orange', NotReady: 'red' }
        return <Tag color={colorMap[s] || 'default'}>{s}</Tag>
      },
    },
    {
      title: '镜像',
      dataIndex: 'images',
      key: 'images',
      ellipsis: true,
      render: (images: string[]) => images?.join(', '),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm:ss'),
    },
  ]

  const podColumns: ColumnsType<K8sResource> = [
    { title: '名称', dataIndex: 'name', key: 'name', width: 300 },
    { title: '命名空间', dataIndex: 'namespace', key: 'namespace', width: 120 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: string) => {
        const colorMap: Record<string, string> = { Running: 'green', Pending: 'orange', Succeeded: 'blue', Failed: 'red' }
        return <Tag color={colorMap[s] || 'default'}>{s}</Tag>
      },
    },
    {
      title: '镜像',
      dataIndex: 'images',
      key: 'images',
      ellipsis: true,
      render: (images: string[]) => images?.join(', '),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm:ss'),
    },
  ]

  const serviceColumns: ColumnsType<K8sResource> = [
    { title: '名称', dataIndex: 'name', key: 'name', width: 200 },
    { title: '命名空间', dataIndex: 'namespace', key: 'namespace', width: 120 },
    {
      title: '类型',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (s: string) => <Tag>{s}</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm:ss'),
    },
  ]

  const nsFilter = (
    <Select
      style={{ width: 200 }}
      placeholder="选择命名空间"
      allowClear
      value={selectedNs || undefined}
      onChange={(v) => setSelectedNs(v || '')}
    >
      {namespaces.map((ns) => (
        <Select.Option key={ns.name} value={ns.name}>
          {ns.name}
        </Select.Option>
      ))}
    </Select>
  )

  const tabItems = [
    {
      key: 'overview',
      label: '概览',
      children: (
        <Spin spinning={loading}>
          {overview && (
            <>
              <div className="metric-grid" style={{ marginBottom: 16 }}>
                <Card className="metric-card metric-card--primary" bordered={false}>
                  <Statistic title="节点" value={overview.ready_nodes} suffix={`/ ${overview.node_count}`} />
                </Card>
                <Card className="metric-card metric-card--success" bordered={false}>
                  <Statistic title="Pod" value={overview.running_pods} suffix={`/ ${overview.pod_count}`} />
                </Card>
                <Card className="metric-card metric-card--primary" bordered={false}>
                  <Statistic title="Deployment" value={overview.deployment_count} />
                </Card>
                <Card className="metric-card metric-card--warning" bordered={false}>
                  <Statistic title="Service" value={overview.service_count} />
                </Card>
              </div>
              <Card className="section-card" bordered={false}>
                <Descriptions title="集群信息" bordered column={2} size="small">
                  <Descriptions.Item label="集群名称">{cluster?.name}</Descriptions.Item>
                  <Descriptions.Item label="集群代码">{cluster?.code}</Descriptions.Item>
                  <Descriptions.Item label="K8s 版本">{overview.version}</Descriptions.Item>
                  <Descriptions.Item label="API Server">{cluster?.api_server}</Descriptions.Item>
                  <Descriptions.Item label="命名空间数">{overview.namespace_count}</Descriptions.Item>
                  <Descriptions.Item label="状态">
                    <Tag color={cluster?.status === 1 ? 'green' : 'red'}>
                      {cluster?.status === 1 ? '正常' : '异常'}
                    </Tag>
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </>
          )}
        </Spin>
      ),
    },
    {
      key: 'nodes',
      label: `节点 (${nodes.length})`,
      children: <Table columns={nodeColumns} dataSource={nodes} rowKey="name" pagination={false} scroll={{ x: 1200 }} />,
    },
    {
      key: 'namespaces',
      label: `命名空间 (${namespaces.length})`,
      children: (
        <Table
          columns={[
            { title: '名称', dataIndex: 'name', key: 'name', width: 200 },
            {
              title: '状态',
              dataIndex: 'status',
              key: 'status',
              width: 100,
              render: (s: string) => <Tag color={s === 'Active' ? 'green' : 'red'}>{s}</Tag>,
            },
            {
              title: '创建时间',
              dataIndex: 'created_at',
              key: 'created_at',
              width: 200,
              render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm:ss'),
            },
          ]}
          dataSource={namespaces}
          rowKey="name"
          pagination={false}
        />
      ),
    },
    {
      key: 'deployments',
      label: `Deployments (${deployments.length})`,
      children: (
        <>
          <div style={{ marginBottom: 16 }}>{nsFilter}</div>
          <Table columns={deploymentColumns} dataSource={deployments} rowKey="name" scroll={{ x: 1000 }} pagination={{ pageSize: 20 }} />
        </>
      ),
    },
    {
      key: 'pods',
      label: `Pods (${pods.length})`,
      children: (
        <>
          <div style={{ marginBottom: 16 }}>{nsFilter}</div>
          <Table columns={podColumns} dataSource={pods} rowKey="name" scroll={{ x: 1000 }} pagination={{ pageSize: 20 }} />
        </>
      ),
    },
    {
      key: 'services',
      label: `Services (${services.length})`,
      children: (
        <>
          <div style={{ marginBottom: 16 }}>{nsFilter}</div>
          <Table columns={serviceColumns} dataSource={services} rowKey="name" scroll={{ x: 1000 }} pagination={{ pageSize: 20 }} />
        </>
      ),
    },
  ]

  return (
    <div className="page-shell fade-in">
      <div className="page-hero">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/k8s/clusters')} />
          <ClusterOutlined style={{ color: '#0ea5e9', fontSize: 20 }} />
          <div>
            <div className="page-hero-title">{cluster?.name || '集群详情'}</div>
            <p className="page-hero-subtitle">集群资源与命名空间视图</p>
          </div>
        </div>
        <div className="page-hero-actions">
          <Button icon={<ReloadOutlined />} onClick={() => { fetchOverview(); fetchNamespaces() }}>
            刷新
          </Button>
        </div>
      </div>

      <Card className="section-card" bordered={false}>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
      </Card>
    </div>
  )
}

export default ClusterDetail
