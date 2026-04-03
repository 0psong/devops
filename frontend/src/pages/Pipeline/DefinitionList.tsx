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
  Select,
  message,
  Popconfirm,
  Tooltip,
  Statistic,
  Drawer,
  Descriptions,
  Badge,
} from 'antd'
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  EyeOutlined,
  BranchesOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { appService, Application } from '@/services/app'
import { pipelineV2Service, PipelineDefinition, PipelineRun } from '@/services/pipeline_v2'

const triggerMap: Record<string, string> = {
  manual: '手动触发',
  webhook: 'Webhook',
  schedule: '定时触发',
}

const runStatusMap: Record<string, { text: string; color: string }> = {
  pending: { text: '等待中', color: 'default' },
  running: { text: '运行中', color: 'processing' },
  success: { text: '成功', color: 'success' },
  failed: { text: '失败', color: 'error' },
  cancelled: { text: '已取消', color: 'warning' },
  waiting_approval: { text: '待审批', color: 'gold' },
}

const DefinitionList: React.FC = () => {
  const [definitions, setDefinitions] = useState<PipelineDefinition[]>([])
  const [runs, setRuns] = useState<PipelineRun[]>([])
  const [loading, setLoading] = useState(false)
  const [apps, setApps] = useState<Application[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [runsVisible, setRunsVisible] = useState(false)
  const [currentDef, setCurrentDef] = useState<PipelineDefinition | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form] = Form.useForm()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)

  const fetchDefinitions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await pipelineV2Service.listDefinitions({ page, page_size: pageSize })
      setDefinitions(res.data.list || [])
      setTotal(res.data.total || 0)
    } catch {
      message.error('获取流水线定义列表失败')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize])

  useEffect(() => {
    fetchDefinitions()
  }, [fetchDefinitions])

  useEffect(() => {
    const fetchApps = async () => {
      try {
        const res = await appService.list({ page: 1, page_size: 100 })
        setApps(res.data.list || [])
      } catch { /* ignore */ }
    }
    fetchApps()
  }, [])

  const handleCreate = async () => {
    try {
      const values = await form.validateFields()
      if (editingId) {
        await pipelineV2Service.updateDefinition(editingId, values)
        message.success('更新成功')
      } else {
        await pipelineV2Service.createDefinition(values)
        message.success('创建成功')
      }
      setModalVisible(false)
      form.resetFields()
      setEditingId(null)
      fetchDefinitions()
    } catch {
      message.error(editingId ? '更新失败' : '创建失败')
    }
  }

  const handleEdit = (record: PipelineDefinition) => {
    setEditingId(record.id)
    form.setFieldsValue({
      name: record.name,
      app_id: record.app_id,
      description: record.description,
      trigger_type: record.trigger_type,
    })
    setModalVisible(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await pipelineV2Service.deleteDefinition(id)
      message.success('删除成功')
      fetchDefinitions()
    } catch {
      message.error('删除失败')
    }
  }

  const handleTrigger = async (id: string) => {
    try {
      await pipelineV2Service.triggerRun(id, {})
      message.success('流水线已触发')
    } catch {
      message.error('触发失败')
    }
  }

  const handleViewRuns = async (record: PipelineDefinition) => {
    setCurrentDef(record)
    try {
      const res = await pipelineV2Service.listRuns({ definition_id: record.id, page: 1, page_size: 20 })
      setRuns(res.data.list || [])
    } catch {
      setRuns([])
    }
    setRunsVisible(true)
  }

  const columns: ColumnsType<PipelineDefinition> = [
    {
      title: '流水线',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (name: string, record) => (
        <a onClick={() => handleViewRuns(record)}>
          <Space><BranchesOutlined />{name}</Space>
        </a>
      ),
    },
    {
      title: '应用',
      key: 'app',
      width: 140,
      render: (_, record) => <Tag>{record.app?.name || '-'}</Tag>,
    },
    {
      title: '触发方式',
      dataIndex: 'trigger_type',
      key: 'trigger_type',
      width: 100,
      render: (v: string) => triggerMap[v] || v,
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (v: boolean) => v ? <Badge status="success" text="启用" /> : <Badge status="default" text="禁用" />,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 200,
      ellipsis: true,
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
      width: 200,
      render: (_, record) => (
        <Space>
          <Tooltip title="触发运行">
            <Button size="small" type="primary" icon={<PlayCircleOutlined />} onClick={() => handleTrigger(record.id)} />
          </Tooltip>
          <Tooltip title="运行记录">
            <Button size="small" icon={<EyeOutlined />} onClick={() => handleViewRuns(record)} />
          </Tooltip>
          <Tooltip title="编辑">
            <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Popconfirm title="确定删除?" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const runColumns: ColumnsType<PipelineRun> = [
    {
      title: '#',
      dataIndex: 'run_number',
      key: 'run_number',
      width: 60,
      render: (v: number) => `#${v}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => {
        const cfg = runStatusMap[v] || { text: v, color: 'default' }
        return <Tag color={cfg.color}>{cfg.text}</Tag>
      },
    },
    {
      title: '分支',
      dataIndex: 'branch',
      key: 'branch',
      width: 120,
      render: (v: string) => v ? <code>{v}</code> : '-',
    },
    {
      title: '耗时',
      dataIndex: 'duration',
      key: 'duration',
      width: 80,
      render: (v: number) => v ? `${v}s` : '-',
    },
    {
      title: '触发时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space>
          {record.status === 'running' && (
            <Button size="small" danger onClick={async () => {
              try { await pipelineV2Service.cancelRun(record.id); message.success('已取消'); if (currentDef) handleViewRuns(currentDef) } catch { message.error('取消失败') }
            }}>取消</Button>
          )}
          {record.status === 'failed' && (
            <Button size="small" type="primary" onClick={async () => {
              try { await pipelineV2Service.retryRun(record.id); message.success('已重试'); if (currentDef) handleViewRuns(currentDef) } catch { message.error('重试失败') }
            }}>重试</Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div className="page-shell fade-in">
      <div className="page-hero">
        <div>
          <div className="page-hero-title">高级流水线</div>
          <p className="page-hero-subtitle">配置可编排的 CI/CD 流水线，支持多阶段、审批和制品管理</p>
        </div>
        <div className="page-hero-actions">
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchDefinitions}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setEditingId(null); setModalVisible(true) }}>
              新建流水线
            </Button>
          </Space>
        </div>
      </div>

      <div className="metric-grid">
        <Card className="metric-card metric-card--primary" bordered={false}>
          <Statistic title="流水线总数" value={total} prefix={<BranchesOutlined style={{ color: '#0ea5e9' }} />} />
        </Card>
        <Card className="metric-card metric-card--success" bordered={false}>
          <Statistic title="已启用" value={definitions.filter(d => d.enabled).length} prefix={<CheckCircleOutlined style={{ color: '#22c55e' }} />} />
        </Card>
        <Card className="metric-card metric-card--primary" bordered={false}>
          <Statistic title="定时触发" value={definitions.filter(d => d.trigger_type === 'schedule').length} prefix={<ClockCircleOutlined style={{ color: '#0ea5e9' }} />} />
        </Card>
      </div>

      <Card className="section-card" bordered={false}>
        <Table
          columns={columns}
          dataSource={definitions}
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
        title={editingId ? '编辑流水线' : '新建流水线'}
        open={modalVisible}
        onOk={handleCreate}
        onCancel={() => { setModalVisible(false); setEditingId(null) }}
        width={560}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="流水线名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如：生产部署流水线" />
          </Form.Item>
          <Form.Item name="app_id" label="关联应用" rules={[{ required: true, message: '请选择应用' }]}>
            <Select placeholder="选择应用">
              {apps.map((a) => (
                <Select.Option key={a.id} value={a.id}>{a.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="trigger_type" label="触发方式" initialValue="manual">
            <Select>
              <Select.Option value="manual">手动触发</Select.Option>
              <Select.Option value="webhook">Webhook</Select.Option>
              <Select.Option value="schedule">定时触发</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="流水线用途说明" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={`运行记录 - ${currentDef?.name || ''}`}
        width={720}
        open={runsVisible}
        onClose={() => setRunsVisible(false)}
      >
        {currentDef && (
          <>
            <Descriptions size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="应用">{currentDef.app?.name || '-'}</Descriptions.Item>
              <Descriptions.Item label="触发方式">{triggerMap[currentDef.trigger_type] || currentDef.trigger_type}</Descriptions.Item>
            </Descriptions>
            <Table
              columns={runColumns}
              dataSource={runs}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 10 }}
              scroll={{ x: 700 }}
            />
          </>
        )}
      </Drawer>
    </div>
  )
}

export default DefinitionList
