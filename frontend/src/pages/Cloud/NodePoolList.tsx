import React, { useState, useEffect, useCallback } from 'react'
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  message,
  Popconfirm,
  Tooltip,
  Statistic,
  Slider,
} from 'antd'
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  ArrowsAltOutlined,
  ClusterOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { cloudService, NodePool, CloudAccount } from '@/services/cloud'

const statusMap: Record<string, { text: string; color: string }> = {
  active: { text: '正常', color: 'success' },
  scaling: { text: '扩缩容中', color: 'processing' },
  error: { text: '异常', color: 'error' },
}

const NodePoolList: React.FC = () => {
  const [pools, setPools] = useState<NodePool[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [scaleVisible, setScaleVisible] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [scalingPool, setScalingPool] = useState<NodePool | null>(null)
  const [desiredSize, setDesiredSize] = useState(0)
  const [accounts, setAccounts] = useState<CloudAccount[]>([])
  const [form] = Form.useForm()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)

  const fetchPools = useCallback(async () => {
    setLoading(true)
    try {
      const res = await cloudService.listNodePools({ page, page_size: pageSize })
      setPools(res.data.list || [])
      setTotal(res.data.total || 0)
    } catch {
      message.error('获取节点池列表失败')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize])

  useEffect(() => {
    fetchPools()
  }, [fetchPools])

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const res = await cloudService.listAccounts({ page: 1, page_size: 100 })
        setAccounts(res.data.list || [])
      } catch { /* ignore */ }
    }
    fetchAccounts()
  }, [])

  const handleCreate = async () => {
    try {
      const values = await form.validateFields()
      if (editingId) {
        await cloudService.updateNodePool(editingId, values)
        message.success('更新成功')
      } else {
        await cloudService.createNodePool(values)
        message.success('创建成功')
      }
      setModalVisible(false)
      form.resetFields()
      setEditingId(null)
      fetchPools()
    } catch {
      message.error(editingId ? '更新失败' : '创建失败')
    }
  }

  const handleEdit = (record: NodePool) => {
    setEditingId(record.id)
    form.setFieldsValue({
      name: record.name,
      min_size: record.min_size,
      max_size: record.max_size,
      desired_size: record.desired_size,
      description: record.description,
    })
    setModalVisible(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await cloudService.deleteNodePool(id)
      message.success('删除成功')
      fetchPools()
    } catch {
      message.error('删除失败')
    }
  }

  const handleScale = async () => {
    if (!scalingPool) return
    try {
      await cloudService.scaleNodePool(scalingPool.id, desiredSize)
      message.success('扩缩容指令已下发')
      setScaleVisible(false)
      fetchPools()
    } catch {
      message.error('扩缩容失败')
    }
  }

  const openScale = (record: NodePool) => {
    setScalingPool(record)
    setDesiredSize(record.desired_size)
    setScaleVisible(true)
  }

  const activeCount = pools.filter((p) => p.status === 'active').length
  const totalNodes = pools.reduce((sum, p) => sum + p.current_size, 0)

  const columns: ColumnsType<NodePool> = [
    {
      title: '节点池名称',
      dataIndex: 'name',
      key: 'name',
      width: 160,
    },
    {
      title: '关联集群',
      key: 'cluster',
      width: 140,
      render: (_, record) => record.cluster?.name || '-',
    },
    {
      title: '云账号',
      key: 'account',
      width: 140,
      render: (_, record) => record.account?.name || '-',
    },
    {
      title: '实例规格',
      dataIndex: 'instance_type',
      key: 'instance_type',
      width: 120,
    },
    {
      title: '节点数量',
      key: 'size',
      width: 160,
      render: (_, record) => (
        <span>
          {record.current_size} / {record.desired_size}
          <span style={{ color: '#8c8c8c', marginLeft: 4 }}>
            ({record.min_size}~{record.max_size})
          </span>
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => {
        const cfg = statusMap[v] || { text: v, color: 'default' }
        return <Tag color={cfg.color}>{cfg.text}</Tag>
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space>
          <Tooltip title="扩缩容">
            <Button size="small" type="primary" icon={<ArrowsAltOutlined />} onClick={() => openScale(record)} />
          </Tooltip>
          <Tooltip title="编辑">
            <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Popconfirm title="确定删除此节点池?" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="page-shell fade-in">
      <div className="page-hero">
        <div>
          <div className="page-hero-title">节点池管理</div>
          <p className="page-hero-subtitle">管理 Kubernetes 集群节点池，支持弹性扩缩容</p>
        </div>
        <div className="page-hero-actions">
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchPools}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setEditingId(null); setModalVisible(true) }}>
              新建节点池
            </Button>
          </Space>
        </div>
      </div>

      <div className="metric-grid">
        <Card className="metric-card metric-card--primary" bordered={false}>
          <Statistic title="节点池" value={total} prefix={<ClusterOutlined style={{ color: '#0ea5e9' }} />} />
        </Card>
        <Card className="metric-card metric-card--success" bordered={false}>
          <Statistic title="正常" value={activeCount} prefix={<CheckCircleOutlined style={{ color: '#22c55e' }} />} />
        </Card>
        <Card className="metric-card metric-card--primary" bordered={false}>
          <Statistic title="总节点数" value={totalNodes} prefix={<ClusterOutlined style={{ color: '#0ea5e9' }} />} />
        </Card>
      </div>

      <Card className="section-card" bordered={false}>
        <Table
          columns={columns}
          dataSource={pools}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps) },
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      <Modal
        title={editingId ? '编辑节点池' : '新建节点池'}
        open={modalVisible}
        onOk={handleCreate}
        onCancel={() => { setModalVisible(false); setEditingId(null) }}
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="节点池名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如：worker-pool" />
          </Form.Item>
          {!editingId && (
            <>
              <Form.Item name="cluster_id" label="关联集群" rules={[{ required: true, message: '请选择集群' }]}>
                <Input placeholder="集群 ID" />
              </Form.Item>
              <Form.Item name="account_id" label="云账号" rules={[{ required: true, message: '请选择账号' }]}>
                <Select placeholder="选择云账号">
                  {accounts.map((a) => (
                    <Select.Option key={a.id} value={a.id}>{a.name}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item name="instance_type" label="实例规格">
                <Input placeholder="如：ecs.c6.large" />
              </Form.Item>
            </>
          )}
          <Form.Item name="min_size" label="最小节点数" initialValue={0}>
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="max_size" label="最大节点数" initialValue={10}>
            <InputNumber min={1} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="desired_size" label="期望节点数" initialValue={1}>
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="description" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`扩缩容 - ${scalingPool?.name || ''}`}
        open={scaleVisible}
        onOk={handleScale}
        onCancel={() => setScaleVisible(false)}
        width={400}
      >
        <div style={{ padding: '16px 0' }}>
          <p>当前节点数: <strong>{scalingPool?.current_size}</strong></p>
          <p>期望节点数:</p>
          <Slider
            min={scalingPool?.min_size || 0}
            max={scalingPool?.max_size || 10}
            value={desiredSize}
            onChange={setDesiredSize}
          />
          <InputNumber
            min={scalingPool?.min_size || 0}
            max={scalingPool?.max_size || 10}
            value={desiredSize}
            onChange={(v) => setDesiredSize(v || 0)}
            style={{ width: '100%' }}
          />
        </div>
      </Modal>
    </div>
  )
}

export default NodePoolList
