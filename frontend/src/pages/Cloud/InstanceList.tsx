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
  Tooltip,
  Statistic,
  Popconfirm,
  Steps,
} from 'antd'
import {
  PlusOutlined,
  ReloadOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  DeleteOutlined,
  SyncOutlined,
  CloudServerOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LinkOutlined,
  DisconnectOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  cloudService,
  CloudInstance,
  CloudAccount,
  Region,
  InstanceTypeInfo,
  Image,
} from '@/services/cloud'

const statusMap: Record<string, { text: string; color: string }> = {
  pending: { text: '创建中', color: 'processing' },
  running: { text: '运行中', color: 'success' },
  stopped: { text: '已停止', color: 'warning' },
  terminated: { text: '已释放', color: 'default' },
}

const providerMap: Record<string, string> = {
  alicloud: '阿里云',
  aws: 'AWS',
}

const InstanceList: React.FC = () => {
  const [instances, setInstances] = useState<CloudInstance[]>([])
  const [loading, setLoading] = useState(false)
  const [accounts, setAccounts] = useState<CloudAccount[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [filterAccount, setFilterAccount] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')

  // Purchase wizard state
  const [wizardStep, setWizardStep] = useState(0)
  const [regions, setRegions] = useState<Region[]>([])
  const [instanceTypes, setInstanceTypes] = useState<InstanceTypeInfo[]>([])
  const [images, setImages] = useState<Image[]>([])

  const fetchInstances = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page, page_size: pageSize }
      if (filterAccount) params.account_id = filterAccount
      if (filterStatus) params.status = filterStatus
      const res = await cloudService.listInstances(params as Parameters<typeof cloudService.listInstances>[0])
      setInstances(res.data.list || [])
      setTotal(res.data.total || 0)
    } catch {
      message.error('获取实例列表失败')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, filterAccount, filterStatus])

  useEffect(() => {
    fetchInstances()
  }, [fetchInstances])

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const res = await cloudService.listAccounts({ page: 1, page_size: 100 })
        setAccounts(res.data.list || [])
      } catch { /* ignore */ }
    }
    fetchAccounts()
  }, [])

  const handleAccountChange = async (accountId: string) => {
    form.setFieldsValue({ account_id: accountId, region: undefined, instance_type: undefined, image_id: undefined })
    if (!accountId) return
    try {
      const res = await cloudService.listRegions(accountId)
      setRegions(res.data || [])
    } catch { message.error('获取区域列表失败') }
  }

  const handleRegionChange = async (region: string) => {
    const accountId = form.getFieldValue('account_id')
    form.setFieldsValue({ instance_type: undefined, image_id: undefined })
    if (!accountId || !region) return
    try {
      const [typeRes, imageRes] = await Promise.all([
        cloudService.listInstanceTypes(accountId, region),
        cloudService.listImages(accountId, region),
      ])
      setInstanceTypes(typeRes.data || [])
      setImages(imageRes.data || [])
    } catch { message.error('获取资源信息失败') }
  }

  const handleCreate = async () => {
    try {
      const values = await form.validateFields()
      await cloudService.createInstance(values)
      message.success('实例创建成功')
      setModalVisible(false)
      form.resetFields()
      setWizardStep(0)
      fetchInstances()
    } catch {
      message.error('创建实例失败')
    }
  }

  const handleAction = async (id: string, action: string) => {
    try {
      switch (action) {
        case 'start': await cloudService.startInstance(id); break
        case 'stop': await cloudService.stopInstance(id); break
        case 'terminate': await cloudService.terminateInstance(id); break
        case 'sync': await cloudService.syncInstance(id); break
        case 'bind': await cloudService.bindHost(id); break
        case 'unbind': await cloudService.unbindHost(id); break
      }
      message.success('操作成功')
      fetchInstances()
    } catch {
      message.error('操作失败')
    }
  }

  const runningCount = instances.filter((i) => i.status === 'running').length
  const stoppedCount = instances.filter((i) => i.status === 'stopped').length

  const columns: ColumnsType<CloudInstance> = [
    {
      title: '实例名称',
      dataIndex: 'name',
      key: 'name',
      width: 160,
    },
    {
      title: '云厂商',
      dataIndex: 'provider',
      key: 'provider',
      width: 80,
      render: (v: string) => providerMap[v] || v,
    },
    {
      title: '实例ID',
      dataIndex: 'instance_id',
      key: 'instance_id',
      width: 160,
      render: (v: string) => <code style={{ fontSize: 12 }}>{v || '-'}</code>,
    },
    {
      title: '规格',
      dataIndex: 'instance_type',
      key: 'instance_type',
      width: 120,
    },
    {
      title: 'IP',
      key: 'ip',
      width: 180,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          {record.public_ip && <span>公: {record.public_ip}</span>}
          {record.private_ip && <span>私: {record.private_ip}</span>}
        </Space>
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
      title: 'CMDB',
      key: 'host',
      width: 100,
      render: (_, record) => record.host_id
        ? <Tag color="green">已上架</Tag>
        : <Tag>未上架</Tag>,
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
        <Space wrap>
          {record.status === 'stopped' && (
            <Tooltip title="启动">
              <Button size="small" type="primary" icon={<PlayCircleOutlined />} onClick={() => handleAction(record.id, 'start')} />
            </Tooltip>
          )}
          {record.status === 'running' && (
            <Tooltip title="停止">
              <Button size="small" icon={<PauseCircleOutlined />} onClick={() => handleAction(record.id, 'stop')} />
            </Tooltip>
          )}
          <Tooltip title="同步状态">
            <Button size="small" icon={<SyncOutlined />} onClick={() => handleAction(record.id, 'sync')} />
          </Tooltip>
          {!record.host_id && record.status === 'running' && (
            <Tooltip title="上架到 CMDB">
              <Button size="small" icon={<LinkOutlined />} onClick={() => handleAction(record.id, 'bind')} />
            </Tooltip>
          )}
          {record.host_id && (
            <Tooltip title="下架">
              <Button size="small" icon={<DisconnectOutlined />} onClick={() => handleAction(record.id, 'unbind')} />
            </Tooltip>
          )}
          {record.status !== 'terminated' && (
            <Popconfirm title="确定释放此实例?" onConfirm={() => handleAction(record.id, 'terminate')}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div className="page-shell fade-in">
      <div className="page-hero">
        <div>
          <div className="page-hero-title">云实例管理</div>
          <p className="page-hero-subtitle">管理云主机实例的生命周期，支持上架到 CMDB</p>
        </div>
        <div className="page-hero-actions">
          <Space>
            <Select
              style={{ width: 160 }}
              allowClear
              placeholder="筛选账号"
              value={filterAccount || undefined}
              onChange={(v) => { setFilterAccount(v || ''); setPage(1) }}
              options={accounts.map((a) => ({ value: a.id, label: a.name }))}
            />
            <Select
              style={{ width: 120 }}
              allowClear
              placeholder="筛选状态"
              value={filterStatus || undefined}
              onChange={(v) => { setFilterStatus(v || ''); setPage(1) }}
              options={[
                { value: 'running', label: '运行中' },
                { value: 'stopped', label: '已停止' },
                { value: 'pending', label: '创建中' },
              ]}
            />
            <Button icon={<ReloadOutlined />} onClick={fetchInstances}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setWizardStep(0); setModalVisible(true) }}>
              购买实例
            </Button>
          </Space>
        </div>
      </div>

      <div className="metric-grid">
        <Card className="metric-card metric-card--primary" bordered={false}>
          <Statistic title="总实例" value={total} prefix={<CloudServerOutlined style={{ color: '#0ea5e9' }} />} />
        </Card>
        <Card className="metric-card metric-card--success" bordered={false}>
          <Statistic title="运行中" value={runningCount} prefix={<CheckCircleOutlined style={{ color: '#22c55e' }} />} />
        </Card>
        <Card className="metric-card metric-card--warning" bordered={false}>
          <Statistic title="已停止" value={stoppedCount} prefix={<CloseCircleOutlined style={{ color: '#f59e0b' }} />} />
        </Card>
      </div>

      <Card className="section-card" bordered={false}>
        <Table
          columns={columns}
          dataSource={instances}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps) },
          }}
          scroll={{ x: 1400 }}
        />
      </Card>

      <Modal
        title="购买云实例"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        width={600}
        footer={
          <Space>
            {wizardStep > 0 && <Button onClick={() => setWizardStep(wizardStep - 1)}>上一步</Button>}
            {wizardStep < 2 && <Button type="primary" onClick={() => setWizardStep(wizardStep + 1)}>下一步</Button>}
            {wizardStep === 2 && <Button type="primary" onClick={handleCreate}>确认购买</Button>}
          </Space>
        }
      >
        <Steps
          current={wizardStep}
          size="small"
          style={{ marginBottom: 24 }}
          items={[
            { title: '选择账号' },
            { title: '选择规格' },
            { title: '确认信息' },
          ]}
        />
        <Form form={form} layout="vertical">
          {wizardStep === 0 && (
            <>
              <Form.Item name="account_id" label="云账号" rules={[{ required: true, message: '请选择云账号' }]}>
                <Select placeholder="选择云账号" onChange={handleAccountChange}>
                  {accounts.map((a) => (
                    <Select.Option key={a.id} value={a.id}>{a.name} ({providerMap[a.provider] || a.provider})</Select.Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item name="region" label="区域" rules={[{ required: true, message: '请选择区域' }]}>
                <Select placeholder="选择区域" onChange={handleRegionChange}>
                  {regions.map((r) => (
                    <Select.Option key={r.id} value={r.id}>{r.name}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </>
          )}
          {wizardStep === 1 && (
            <>
              <Form.Item name="instance_type" label="实例规格" rules={[{ required: true, message: '请选择规格' }]}>
                <Select placeholder="选择实例规格">
                  {instanceTypes.map((t) => (
                    <Select.Option key={t.id} value={t.id}>{t.name} ({t.cpu}C / {t.memory}MB)</Select.Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item name="image_id" label="系统镜像" rules={[{ required: true, message: '请选择镜像' }]}>
                <Select placeholder="选择系统镜像">
                  {images.map((img) => (
                    <Select.Option key={img.id} value={img.id}>{img.name} ({img.os})</Select.Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item name="charge_type" label="计费方式" initialValue="PostPaid">
                <Select>
                  <Select.Option value="PostPaid">按量付费</Select.Option>
                  <Select.Option value="PrePaid">包年包月</Select.Option>
                </Select>
              </Form.Item>
            </>
          )}
          {wizardStep === 2 && (
            <>
              <Form.Item name="name" label="实例名称" rules={[{ required: true, message: '请输入实例名称' }]}>
                <Input placeholder="如：web-server-01" />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </div>
  )
}

export default InstanceList
