import React, { useState, useEffect, useCallback } from 'react'
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Statistic,
  Select,
  Modal,
  Form,
  Input,
  message,
  Popconfirm,
  Tooltip,
  Drawer,
  Descriptions,
} from 'antd'
import {
  TagsOutlined,
  PlusOutlined,
  ReloadOutlined,
  RollbackOutlined,
  EyeOutlined,
  RocketOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { appService, Application } from '@/services/app'
import { versionService, AppVersion } from '@/services/version'

const PipelineList: React.FC = () => {
  const [versions, setVersions] = useState<AppVersion[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(false)
  const [apps, setApps] = useState<Application[]>([])
  const [selectedApp, setSelectedApp] = useState<string>('')
  const [modalVisible, setModalVisible] = useState(false)
  const [detailVisible, setDetailVisible] = useState(false)
  const [currentVersion, setCurrentVersion] = useState<AppVersion | null>(null)
  const [form] = Form.useForm()

  const fetchVersions = useCallback(async () => {
    setLoading(true)
    try {
      const params: { page: number; page_size: number; app_id?: string } = {
        page,
        page_size: pageSize,
      }
      if (selectedApp) {
        params.app_id = selectedApp
      }
      const res = await versionService.list(params)
      setVersions(res.data.list || [])
      setTotal(res.data.total || 0)
    } catch {
      message.error('获取版本列表失败')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, selectedApp])

  useEffect(() => {
    const fetchApps = async () => {
      try {
        const res = await appService.list({ page: 1, page_size: 100 })
        setApps(res.data.list || [])
      } catch { message.error('获取应用列表失败') }
    }
    fetchApps()
  }, [])

  useEffect(() => {
    fetchVersions()
  }, [fetchVersions])

  const currentCount = versions.filter((v) => v.is_current).length

  const handleCreate = async () => {
    try {
      const values = await form.validateFields()
      await versionService.create({
        app_id: values.app_id,
        version: values.version,
        branch: values.branch || undefined,
        commit_id: values.commit_id || undefined,
        commit_msg: values.commit_msg || undefined,
        changelog: values.changelog || undefined,
      })
      setModalVisible(false)
      message.success('版本已创建')
      fetchVersions()
    } catch {
      message.error('创建版本失败')
    }
  }

  const handleRollback = async (v: AppVersion) => {
    try {
      await versionService.rollback(v.id)
      message.success(`已回滚到 ${v.version}`)
      fetchVersions()
    } catch {
      message.error('回滚失败')
    }
  }

  const handleDeploy = async (v: AppVersion) => {
    try {
      await versionService.deploy(v.id)
      message.success(`${v.version} 部署已触发`)
      fetchVersions()
    } catch {
      message.error('部署失败')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await versionService.delete(id)
      message.success('删除成功')
      fetchVersions()
    } catch {
      message.error('删除失败')
    }
  }

  const columns: ColumnsType<AppVersion> = [
    {
      title: '版本号',
      dataIndex: 'version',
      key: 'version',
      width: 130,
      render: (v: string, record) => (
        <Space>
          <a onClick={() => { setCurrentVersion(record); setDetailVisible(true) }}>
            <Tag color="blue">{v}</Tag>
          </a>
          {record.is_current && <Tag color="green">当前</Tag>}
        </Space>
      ),
    },
    {
      title: '应用',
      key: 'app_name',
      width: 140,
      render: (_, record) => <Tag>{record.app?.name || '-'}</Tag>,
    },
    {
      title: '分支',
      dataIndex: 'branch',
      key: 'branch',
      width: 140,
      render: (v: string) => <code>{v}</code>,
    },
    {
      title: 'Commit',
      dataIndex: 'commit_id',
      key: 'commit_id',
      width: 120,
      render: (v: string) => <code style={{ whiteSpace: 'nowrap' }}>{v}</code>,
    },
    {
      title: '提交信息',
      dataIndex: 'commit_msg',
      key: 'commit_msg',
      ellipsis: true,
    },
    {
      title: '构建状态',
      dataIndex: 'build_status',
      key: 'build_status',
      width: 100,
      render: (s: string) => {
        const map: Record<string, { text: string; color: string }> = {
          success: { text: '成功', color: 'success' },
          failed: { text: '失败', color: 'error' },
          building: { text: '构建中', color: 'processing' },
          pending: { text: '待构建', color: 'default' },
        }
        const cfg = map[s] || map.pending
        return <Tag color={cfg.color}>{cfg.text}</Tag>
      },
    },
    {
      title: '部署次数',
      dataIndex: 'deploy_count',
      key: 'deploy_count',
      width: 90,
      render: (v: number) => v,
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
      width: 220,
      render: (_, record) => (
        <Space>
          <Tooltip title="查看">
            <Button size="small" icon={<EyeOutlined />} onClick={() => { setCurrentVersion(record); setDetailVisible(true) }} />
          </Tooltip>
          <Tooltip title="部署此版本">
            <Button size="small" type="primary" icon={<RocketOutlined />} onClick={() => handleDeploy(record)} />
          </Tooltip>
          {!record.is_current && (
            <Popconfirm title={`确定回滚到 ${record.version}?`} onConfirm={() => handleRollback(record)}>
              <Tooltip title="回滚">
                <Button size="small" icon={<RollbackOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
          <Popconfirm title="确定删除此版本?" onConfirm={() => handleDelete(record.id)}>
            <Tooltip title="删除">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="page-shell fade-in">
      <div className="page-hero">
        <div>
          <div className="page-hero-title">版本管理</div>
          <p className="page-hero-subtitle">管理应用版本、发布和回滚操作</p>
        </div>
        <div className="page-hero-actions">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalVisible(true) }}>
            创建版本
          </Button>
        </div>
      </div>

      <div className="metric-grid">
        <Card className="metric-card metric-card--primary" bordered={false}>
          <Statistic title="总版本数" value={total} prefix={<TagsOutlined style={{ color: '#0ea5e9' }} />} />
        </Card>
        <Card className="metric-card metric-card--success" bordered={false}>
          <Statistic title="当前版本" value={currentCount} prefix={<CheckCircleOutlined style={{ color: '#22c55e' }} />} />
        </Card>
        <Card className="metric-card metric-card--warning" bordered={false}>
          <Statistic title="待部署" value={versions.filter((v) => v.deploy_count === 0).length} prefix={<ClockCircleOutlined style={{ color: '#f59e0b' }} />} />
        </Card>
      </div>

      <Card className="section-card" bordered={false}>
        <div className="toolbar">
          <div className="toolbar-left">
            <Select
              style={{ width: 220 }}
              placeholder="全部应用"
              allowClear
              value={selectedApp || undefined}
              onChange={(v) => { setSelectedApp(v || ''); setPage(1) }}
            >
              {apps.map((a) => (
                <Select.Option key={a.id} value={a.id}>{a.name}</Select.Option>
              ))}
            </Select>
          </div>
          <div className="toolbar-right">
            <Button icon={<ReloadOutlined />} onClick={() => fetchVersions()}>刷新</Button>
          </div>
        </div>
        <Table
          columns={columns}
          dataSource={versions}
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
        title="创建版本"
        open={modalVisible}
        onOk={handleCreate}
        onCancel={() => setModalVisible(false)}
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="app_id" label="应用" rules={[{ required: true, message: '请选择应用' }]}>
            <Select placeholder="选择应用">
              {apps.map((a) => (
                <Select.Option key={a.id} value={a.id}>{a.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="version" label="版本号" rules={[{ required: true, message: '请输入版本号' }]}>
            <Input placeholder="v1.0.0" />
          </Form.Item>
          <Form.Item name="branch" label="分支">
            <Input placeholder="main" />
          </Form.Item>
          <Form.Item name="commit_id" label="Commit ID">
            <Input placeholder="a1b2c3d" />
          </Form.Item>
          <Form.Item name="commit_msg" label="提交信息">
            <Input placeholder="feat: 新功能描述" />
          </Form.Item>
          <Form.Item name="changelog" label="更新日志">
            <Input.TextArea rows={4} placeholder="- 新增功能 A&#10;- 修复 Bug B" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={`版本 ${currentVersion?.version}`}
        width={560}
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
      >
        {currentVersion && (
          <>
            <Descriptions bordered column={1} style={{ marginBottom: 24 }}>
              <Descriptions.Item label="版本号">
                <Space>
                  <Tag color="blue">{currentVersion.version}</Tag>
                  {currentVersion.is_current && <Tag color="green">当前版本</Tag>}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="应用">{currentVersion.app?.name || '-'}</Descriptions.Item>
              <Descriptions.Item label="分支">{currentVersion.branch}</Descriptions.Item>
              <Descriptions.Item label="Commit">{currentVersion.commit_id}</Descriptions.Item>
              <Descriptions.Item label="提交信息">{currentVersion.commit_msg}</Descriptions.Item>
              <Descriptions.Item label="构建状态">
                <Tag color={currentVersion.build_status === 'success' ? 'green' : 'default'}>
                  {currentVersion.build_status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="部署次数">{currentVersion.deploy_count}</Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {dayjs(currentVersion.created_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
            </Descriptions>

            {currentVersion.changelog && (
              <>
                <h4 style={{ marginBottom: 12 }}>更新日志</h4>
                <Card style={{ background: '#fafafa' }}>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 13 }}>
                    {currentVersion.changelog}
                  </pre>
                </Card>
              </>
            )}
          </>
        )}
      </Drawer>
    </div>
  )
}

export default PipelineList
