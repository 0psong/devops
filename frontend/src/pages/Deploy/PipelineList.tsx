import React, { useState, useEffect, useCallback } from 'react'
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Statistic,
  Modal,
  Form,
  Input,
  Select,
  Steps,
  Timeline,
  Drawer,
  message,
  Popconfirm,
  Tooltip,
  Progress,
} from 'antd'
import {
  PlusOutlined,
  BranchesOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  EyeOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { appService, Application } from '@/services/app'
import { pipelineService, Pipeline, PipelineStage } from '@/services/pipeline'

const statusConfig: Record<string, { text: string; color: string; icon: React.ReactNode }> = {
  pending: { text: '等待中', color: 'default', icon: <ClockCircleOutlined /> },
  running: { text: '运行中', color: 'processing', icon: <SyncOutlined spin /> },
  success: { text: '成功', color: 'success', icon: <CheckCircleOutlined /> },
  failed: { text: '失败', color: 'error', icon: <CloseCircleOutlined /> },
  cancelled: { text: '已取消', color: 'warning', icon: <CloseCircleOutlined /> },
  skipped: { text: '跳过', color: 'default', icon: <ClockCircleOutlined /> },
}

const PipelineList: React.FC = () => {
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [loading, setLoading] = useState(false)
  const [apps, setApps] = useState<Application[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [detailVisible, setDetailVisible] = useState(false)
  const [currentPipeline, setCurrentPipeline] = useState<Pipeline | null>(null)
  const [form] = Form.useForm()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)

  const fetchPipelines = useCallback(async () => {
    setLoading(true)
    try {
      const res = await pipelineService.list({ page, page_size: pageSize })
      setPipelines(res.data.list || [])
      setTotal(res.data.total || 0)
    } catch {
      message.error('获取流水线列表失败')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize])

  useEffect(() => {
    fetchPipelines()
  }, [fetchPipelines])

  useEffect(() => {
    const fetchApps = async () => {
      try {
        const res = await appService.list({ page: 1, page_size: 100 })
        setApps(res.data.list || [])
      } catch { message.error('获取应用列表失败') }
    }
    fetchApps()
  }, [])

  const handleCreate = async () => {
    try {
      const values = await form.validateFields()
      await pipelineService.create({
        name: values.name,
        app_id: values.app_id,
        branch: values.branch || undefined,
        trigger: values.trigger || undefined,
      })
      setModalVisible(false)
      form.resetFields()
      message.success('流水线已创建')
      fetchPipelines()
    } catch { message.error('创建流水线失败') }
  }

  const handleRun = async (p: Pipeline) => {
    try {
      await pipelineService.run(p.id)
      message.success('流水线已触发')
      fetchPipelines()
    } catch { message.error('触发流水线失败') }
  }

  const handleDelete = async (id: string) => {
    try {
      await pipelineService.delete(id)
      message.success('已删除')
      fetchPipelines()
    } catch { message.error('删除失败') }
  }

  const handleViewDetail = async (record: Pipeline) => {
    try {
      const res = await pipelineService.get(record.id)
      setCurrentPipeline(res.data)
    } catch {
      setCurrentPipeline(record)
    }
    setDetailVisible(true)
  }

  const successCount = pipelines.filter((p) => p.status === 'success').length
  const runningCount = pipelines.filter((p) => p.status === 'running').length
  const failedCount = pipelines.filter((p) => p.status === 'failed').length

  const columns: ColumnsType<Pipeline> = [
    {
      title: '流水线',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (name: string, record) => (
        <a onClick={() => handleViewDetail(record)}>
          <Space>
            <BranchesOutlined />
            {name}
          </Space>
        </a>
      ),
    },
    {
      title: '应用',
      key: 'app_name',
      width: 140,
      render: (_: unknown, record) => <Tag>{record.app?.name || '-'}</Tag>,
    },
    {
      title: '分支',
      dataIndex: 'branch',
      key: 'branch',
      width: 140,
      render: (v: string) => <code>{v}</code>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: string) => {
        const cfg = statusConfig[s] || statusConfig.pending
        return <Tag icon={cfg.icon} color={cfg.color}>{cfg.text}</Tag>
      },
    },
    {
      title: '阶段进度',
      key: 'progress',
      width: 180,
      render: (_, record) => {
        const stages = record.stages || []
        const done = stages.filter((s: PipelineStage) => s.status === 'success').length
        const stageTotal = stages.length
        const pct = stageTotal > 0 ? Math.round((done / stageTotal) * 100) : 0
        const color = record.status === 'failed' ? '#ff4d4f' : record.status === 'success' ? '#52c41a' : '#0ea5e9'
        return <Progress percent={pct} size="small" strokeColor={color} format={() => `${done}/${stageTotal}`} />
      },
    },
    {
      title: '耗时',
      dataIndex: 'duration',
      key: 'duration',
      width: 80,
      render: (v: number) => v ? `${v}s` : '-',
    },
    {
      title: '触发方式',
      dataIndex: 'trigger',
      key: 'trigger',
      width: 100,
      render: (v: string) => <Tag>{v === 'webhook' ? 'Webhook' : v === 'schedule' ? '定时' : '手动'}</Tag>,
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          <Tooltip title="查看">
            <Button size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)} />
          </Tooltip>
          {(record.status === 'pending' || record.status === 'failed') && (
            <Tooltip title="运行">
              <Button size="small" type="primary" icon={<PlayCircleOutlined />} onClick={() => handleRun(record)} />
            </Tooltip>
          )}
          <Popconfirm title="确定删除?" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const getStepStatus = (status: string) => {
    if (status === 'success') return 'finish' as const
    if (status === 'running') return 'process' as const
    if (status === 'failed') return 'error' as const
    return 'wait' as const
  }

  return (
    <div className="page-shell fade-in">
      <div className="page-hero">
        <div>
          <div className="page-hero-title">CI/CD 流水线</div>
          <p className="page-hero-subtitle">管理持续集成和持续部署流水线</p>
        </div>
        <div className="page-hero-actions">
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchPipelines}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalVisible(true) }}>
              新建流水线
            </Button>
          </Space>
        </div>
      </div>

      <div className="metric-grid">
        <Card className="metric-card metric-card--success" bordered={false}>
          <Statistic title="成功" value={successCount} prefix={<CheckCircleOutlined style={{ color: '#22c55e' }} />} />
        </Card>
        <Card className="metric-card metric-card--primary" bordered={false}>
          <Statistic title="运行中" value={runningCount} prefix={<SyncOutlined spin style={{ color: '#0ea5e9' }} />} />
        </Card>
        <Card className="metric-card metric-card--danger" bordered={false}>
          <Statistic title="失败" value={failedCount} prefix={<CloseCircleOutlined style={{ color: '#ef4444' }} />} />
        </Card>
      </div>

      <Card className="section-card" bordered={false}>
        <Table
          columns={columns}
          dataSource={pipelines}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: total,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps) },
          }}
          scroll={{ x: 1400 }}
        />
      </Card>

      <Modal
        title="新建流水线"
        open={modalVisible}
        onOk={handleCreate}
        onCancel={() => setModalVisible(false)}
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="流水线名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="生产部署流水线" />
          </Form.Item>
          <Form.Item name="app_id" label="关联应用" rules={[{ required: true, message: '请选择应用' }]}>
            <Select placeholder="选择应用">
              {apps.map((a) => (
                <Select.Option key={a.id} value={a.id}>{a.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="branch" label="分支">
            <Input placeholder="main" />
          </Form.Item>
          <Form.Item name="trigger" label="触发方式" initialValue="manual">
            <Select>
              <Select.Option value="manual">手动触发</Select.Option>
              <Select.Option value="webhook">Webhook</Select.Option>
              <Select.Option value="schedule">定时触发</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={currentPipeline?.name || '流水线详情'}
        width={640}
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
      >
        {currentPipeline && (
          <>
            <div style={{ marginBottom: 24 }}>
              <Space>
                <Tag>{currentPipeline.app?.name || '-'}</Tag>
                <code>{currentPipeline.branch}</code>
                {(() => {
                  const cfg = statusConfig[currentPipeline.status]
                  return <Tag icon={cfg.icon} color={cfg.color}>{cfg.text}</Tag>
                })()}
                <span style={{ color: '#8c8c8c' }}>耗时 {currentPipeline.duration}s</span>
              </Space>
            </div>

            <h4 style={{ marginBottom: 16 }}>阶段进度</h4>
            <Steps
              size="small"
              current={(currentPipeline.stages || []).findIndex((s: PipelineStage) => s.status === 'running')}
              items={(currentPipeline.stages || []).map((s: PipelineStage) => ({
                title: s.name,
                status: getStepStatus(s.status),
                description: s.duration ? `${s.duration}s` : undefined,
              }))}
              style={{ marginBottom: 24 }}
            />

            <h4 style={{ marginBottom: 16 }}>执行日志</h4>
            <Timeline
              items={(currentPipeline.stages || []).map((s: PipelineStage) => ({
                color: s.status === 'success' ? 'green' : s.status === 'failed' ? 'red' : s.status === 'running' ? 'blue' : 'gray',
                children: (
                  <div>
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>{s.name}</div>
                    {s.log && (
                      <pre style={{
                        background: '#1a1a2e',
                        color: '#e0e0e0',
                        padding: 12,
                        borderRadius: 6,
                        fontSize: 12,
                        maxHeight: 120,
                        overflow: 'auto',
                        whiteSpace: 'pre-wrap',
                      }}>
                        {s.log}
                      </pre>
                    )}
                  </div>
                ),
              }))}
            />
          </>
        )}
      </Drawer>
    </div>
  )
}

export default PipelineList
