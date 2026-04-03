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
  Card,
  Statistic,
} from 'antd'
import { PlusOutlined, ReloadOutlined, CloudServerOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { appService, Application, Environment } from '@/services/app'

const AppList: React.FC = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [apps, setApps] = useState<Application[]>([])
  const [envs, setEnvs] = useState<Environment[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingApp, setEditingApp] = useState<Application | null>(null)
  const [form] = Form.useForm()

  const fetchApps = async () => {
    setLoading(true)
    try {
      const res = await appService.list({ page, page_size: pageSize })
      setApps(res.data.list || [])
      setTotal(res.data.total)
    } catch {
      message.error('获取应用列表失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchEnvs = async () => {
    try {
      const res = await appService.listEnvironments()
      setEnvs(res.data || [])
    } catch {
      message.error('获取环境列表失败')
    }
  }

  useEffect(() => {
    fetchApps()
    fetchEnvs()
  }, [page, pageSize])

  const handleAdd = () => {
    setEditingApp(null)
    form.resetFields()
    form.setFieldsValue({ type: 'web', branch: 'main' })
    setModalVisible(true)
  }

  const handleEdit = (record: Application) => {
    setEditingApp(record)
    form.setFieldsValue(record)
    setModalVisible(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await appService.delete(id)
      message.success('删除成功')
      fetchApps()
    } catch {
      message.error('删除失败')
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editingApp) {
        await appService.update(editingApp.id, values)
        message.success('更新成功')
      } else {
        await appService.create(values)
        message.success('创建成功')
      }
      setModalVisible(false)
      fetchApps()
    } catch {
      message.error('提交失败')
    }
  }

  const typeOptions = [
    { label: 'Web 应用', value: 'web' },
    { label: 'API 服务', value: 'api' },
    { label: '后台服务', value: 'service' },
    { label: '定时任务', value: 'job' },
  ]

  const languageOptions = [
    { label: 'Go', value: 'go' },
    { label: 'Java', value: 'java' },
    { label: 'Python', value: 'python' },
    { label: 'Node.js', value: 'nodejs' },
  ]

  const totalCount = total || apps.length
  const activeCount = apps.filter((a) => a.status === 1).length
  const disabledCount = apps.filter((a) => a.status === 0).length

  const columns: ColumnsType<Application> = [
    { title: '应用名称', dataIndex: 'name', key: 'name', width: 150 },
    { title: '应用代码', dataIndex: 'code', key: 'code', width: 120 },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: string) => typeOptions.find((t) => t.value === type)?.label || type,
    },
    { title: '语言', dataIndex: 'language', key: 'language', width: 80 },
    { title: '分支', dataIndex: 'branch', key: 'branch', width: 100 },
    {
      title: '环境',
      dataIndex: 'env',
      key: 'env',
      width: 100,
      render: (env: Environment) =>
        env ? <Tag color={env.color}>{env.name}</Tag> : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: number) => (
        <Tag color={status === 1 ? 'green' : 'red'}>
          {status === 1 ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button size="small" type="primary" onClick={() => navigate(`/deploy/apps/${record.id}`)}>
            详情
          </Button>
          <Button size="small" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确定删除?" onConfirm={() => handleDelete(record.id)}>
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
          <div className="page-hero-title">应用管理</div>
          <p className="page-hero-subtitle">管理应用生命周期，支持多环境部署</p>
        </div>
        <div className="page-hero-actions">
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加应用
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchApps}>
            刷新
          </Button>
        </div>
      </div>

      <div className="metric-grid">
        <Card className="metric-card metric-card--primary" bordered={false}>
          <Statistic title="应用总数" value={totalCount} prefix={<CloudServerOutlined style={{ color: '#0ea5e9' }} />} />
        </Card>
        <Card className="metric-card metric-card--success" bordered={false}>
          <Statistic title="启用" value={activeCount} prefix={<CheckCircleOutlined style={{ color: '#22c55e' }} />} />
        </Card>
        <Card className="metric-card metric-card--danger" bordered={false}>
          <Statistic title="禁用" value={disabledCount} prefix={<CloseCircleOutlined style={{ color: '#ef4444' }} />} />
        </Card>
      </div>

      <Card className="section-card" bordered={false}>
        <Table
          columns={columns}
          dataSource={apps}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1000 }}
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
        title={editingApp ? '编辑应用' : '添加应用'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={700}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="应用名称" rules={[{ required: true }]}>
            <Input placeholder="My App" />
          </Form.Item>
          <Form.Item name="code" label="应用代码" rules={[{ required: true }]}>
            <Input placeholder="my-app" disabled={!!editingApp} />
          </Form.Item>
          <Form.Item name="type" label="应用类型" rules={[{ required: true }]}>
            <Select options={typeOptions} />
          </Form.Item>
          <Form.Item name="language" label="开发语言">
            <Select options={languageOptions} allowClear />
          </Form.Item>
          <Form.Item name="repo_url" label="仓库地址">
            <Input placeholder="https://github.com/user/repo.git" />
          </Form.Item>
          <Form.Item name="branch" label="默认分支">
            <Input placeholder="main" />
          </Form.Item>
          <Form.Item name="deploy_path" label="部署路径">
            <Input placeholder="/opt/apps/my-app" />
          </Form.Item>
          <Form.Item name="env_id" label="环境">
            <Select allowClear placeholder="选择环境">
              {envs.map((e) => (
                <Select.Option key={e.id} value={e.id}>
                  <Tag color={e.color}>{e.name}</Tag>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="build_cmd" label="构建命令">
            <Input.TextArea rows={2} placeholder="go build -o app ." />
          </Form.Item>
          <Form.Item name="start_cmd" label="启动命令">
            <Input.TextArea rows={2} placeholder="./app" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default AppList
