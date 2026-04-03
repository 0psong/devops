import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  message,
  Popconfirm,
  Tooltip,
  Card,
  Statistic,
} from 'antd'
import {
  PlusOutlined,
  ReloadOutlined,
  ApiOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  ClusterOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { k8sService, Cluster } from '@/services/k8s'

const envOptions = [
  { label: '开发环境', value: 'dev', color: '#52c41a' },
  { label: '测试环境', value: 'test', color: '#faad14' },
  { label: '预发环境', value: 'staging', color: '#1890ff' },
  { label: '生产环境', value: 'prod', color: '#f5222d' },
]

const ClusterList: React.FC = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingCluster, setEditingCluster] = useState<Cluster | null>(null)
  const [testLoading, setTestLoading] = useState<string>('')
  const [form] = Form.useForm()

  const fetchClusters = async () => {
    setLoading(true)
    try {
      const res = await k8sService.listClusters({ page, page_size: pageSize })
      setClusters(res.data.list || [])
      setTotal(res.data.total)
    } catch {
      message.error('获取集群列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchClusters()
  }, [page, pageSize])

  const handleAdd = () => {
    setEditingCluster(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEdit = (record: Cluster) => {
    setEditingCluster(record)
    form.setFieldsValue({
      name: record.name,
      api_server: record.api_server,
      env_code: record.env_code,
      description: record.description,
    })
    setModalVisible(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await k8sService.deleteCluster(id)
      message.success('删除成功')
      fetchClusters()
    } catch {
      message.error('删除失败')
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editingCluster) {
        await k8sService.updateCluster(editingCluster.id, values)
        message.success('更新成功')
      } else {
        await k8sService.createCluster(values)
        message.success('创建成功')
      }
      setModalVisible(false)
      fetchClusters()
    } catch {
      message.error('提交失败')
    }
  }

  const handleTestConnection = async (id: string) => {
    setTestLoading(id)
    try {
      await k8sService.testConnection(id)
      message.success('连接成功')
      fetchClusters()
    } catch {
      message.error('连接失败')
    } finally {
      setTestLoading('')
    }
  }

  const statusIcon = (status: number) => {
    switch (status) {
      case 1:
        return <CheckCircleOutlined style={{ color: '#22c55e' }} />
      case 2:
        return <CloseCircleOutlined style={{ color: '#ef4444' }} />
      default:
        return <ExclamationCircleOutlined style={{ color: '#f59e0b' }} />
    }
  }

  const statusText = (status: number) => {
    switch (status) {
      case 1:
        return '正常'
      case 2:
        return '连接失败'
      default:
        return '未知'
    }
  }

  const totalCount = total || clusters.length
  const normalCount = clusters.filter((c) => c.status === 1).length
  const abnormalCount = clusters.filter((c) => c.status !== 1).length

  const columns: ColumnsType<Cluster> = [
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 70,
      render: (status: number) => (
        <Tooltip title={statusText(status)}>{statusIcon(status)}</Tooltip>
      ),
    },
    { title: '集群名称', dataIndex: 'name', key: 'name', width: 160 },
    { title: '版本', dataIndex: 'version', key: 'version', width: 100 },
    { title: 'API Server', dataIndex: 'api_server', key: 'api_server', width: 240, ellipsis: true },
    {
      title: '环境',
      dataIndex: 'env_code',
      key: 'env_code',
      width: 100,
      render: (code: string) => {
        const env = envOptions.find((e) => e.value === code)
        return env ? <Tag color={env.color}>{env.label}</Tag> : '-'
      },
    },
    { title: '节点数', dataIndex: 'node_count', key: 'node_count', width: 80 },
    { title: 'Pod 数', dataIndex: 'pod_count', key: 'pod_count', width: 80 },
    {
      title: '最近检测',
      dataIndex: 'last_check_at',
      key: 'last_check_at',
      width: 160,
      render: (t: string) => (t ? dayjs(t).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            type="primary"
            onClick={() => navigate(`/k8s/clusters/${record.id}`)}
          >
            详情
          </Button>
          <Button
            size="small"
            icon={<ApiOutlined />}
            loading={testLoading === record.id}
            onClick={() => handleTestConnection(record.id)}
          >
            测试
          </Button>
          <Button size="small" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确定删除该集群?" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="page-shell fade-in">
      <div className="page-hero">
        <div>
          <div className="page-hero-title">Kubernetes 集群管理</div>
          <p className="page-hero-subtitle">管理 Kubernetes 集群，查看资源状态</p>
        </div>
        <div className="page-hero-actions">
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加集群
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchClusters}>
            刷新
          </Button>
        </div>
      </div>

      <div className="metric-grid">
        <Card className="metric-card metric-card--primary" bordered={false}>
          <Statistic title="集群总数" value={totalCount} prefix={<ClusterOutlined style={{ color: '#0ea5e9' }} />} />
        </Card>
        <Card className="metric-card metric-card--success" bordered={false}>
          <Statistic title="正常" value={normalCount} prefix={<CheckCircleOutlined style={{ color: '#22c55e' }} />} />
        </Card>
        <Card className="metric-card metric-card--danger" bordered={false}>
          <Statistic title="异常" value={abnormalCount} prefix={<CloseCircleOutlined style={{ color: '#ef4444' }} />} />
        </Card>
      </div>

      <Card className="section-card" bordered={false}>
        <Table
          columns={columns}
          dataSource={clusters}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
        />
      </Card>

      <Modal
        title={editingCluster ? '编辑集群' : '添加集群'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={700}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="集群名称" rules={[{ required: true, message: '请输入集群名称' }]}>
            <Input placeholder="production-cluster" />
          </Form.Item>
          <Form.Item name="api_server" label="API Server" rules={[{ required: true, message: '请输入 API Server 地址' }]}>
            <Input placeholder="https://k8s-api.example.com:6443" />
          </Form.Item>
          <Form.Item
            name="kubeconfig"
            label="KubeConfig"
            rules={editingCluster ? [] : [{ required: true, message: '请粘贴 kubeconfig 内容' }]}
            extra={editingCluster ? '留空则不修改' : ''}
          >
            <Input.TextArea rows={6} placeholder="粘贴 kubeconfig YAML 内容..." />
          </Form.Item>
          <Form.Item name="env_code" label="所属环境">
            <Select allowClear placeholder="选择环境" options={envOptions} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default ClusterList
