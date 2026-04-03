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
} from 'antd'
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  SafetyCertificateOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CloudOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { cloudService, CloudAccount } from '@/services/cloud'

const providerOptions = [
  { value: 'alicloud', label: '阿里云' },
  { value: 'aws', label: 'AWS' },
]

const providerMap: Record<string, { text: string; color: string }> = {
  alicloud: { text: '阿里云', color: 'orange' },
  aws: { text: 'AWS', color: 'geekblue' },
}

const statusMap: Record<number, { text: string; color: string }> = {
  1: { text: '正常', color: 'success' },
  0: { text: '禁用', color: 'default' },
  2: { text: '验证失败', color: 'error' },
}

const AccountList: React.FC = () => {
  const [accounts, setAccounts] = useState<CloudAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form] = Form.useForm()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)

  const fetchAccounts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await cloudService.listAccounts({ page, page_size: pageSize })
      setAccounts(res.data.list || [])
      setTotal(res.data.total || 0)
    } catch {
      message.error('获取云账号列表失败')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  const handleCreate = async () => {
    try {
      const values = await form.validateFields()
      if (editingId) {
        await cloudService.updateAccount(editingId, values)
        message.success('更新成功')
      } else {
        await cloudService.createAccount(values)
        message.success('创建成功')
      }
      setModalVisible(false)
      form.resetFields()
      setEditingId(null)
      fetchAccounts()
    } catch {
      message.error(editingId ? '更新失败' : '创建失败')
    }
  }

  const handleEdit = (record: CloudAccount) => {
    setEditingId(record.id)
    form.setFieldsValue({
      name: record.name,
      provider: record.provider,
      region: record.region,
      description: record.description,
    })
    setModalVisible(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await cloudService.deleteAccount(id)
      message.success('删除成功')
      fetchAccounts()
    } catch {
      message.error('删除失败')
    }
  }

  const handleVerify = async (id: string) => {
    try {
      await cloudService.verifyAccount(id)
      message.success('验证成功')
      fetchAccounts()
    } catch {
      message.error('验证失败')
    }
  }

  const normalCount = accounts.filter((a) => a.status === 1).length

  const columns: ColumnsType<CloudAccount> = [
    {
      title: '账号名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
    },
    {
      title: '云提供商',
      dataIndex: 'provider',
      key: 'provider',
      width: 120,
      render: (v: string) => {
        const cfg = providerMap[v] || { text: v, color: 'default' }
        return <Tag color={cfg.color}>{cfg.text}</Tag>
      },
    },
    {
      title: '区域',
      dataIndex: 'region',
      key: 'region',
      width: 140,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: number) => {
        const cfg = statusMap[v] || { text: '未知', color: 'default' }
        return <Tag color={cfg.color}>{cfg.text}</Tag>
      },
    },
    {
      title: '备注',
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
      width: 180,
      render: (_, record) => (
        <Space>
          <Tooltip title="验证">
            <Button size="small" icon={<SafetyCertificateOutlined />} onClick={() => handleVerify(record.id)} />
          </Tooltip>
          <Tooltip title="编辑">
            <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Popconfirm title="确定删除此云账号?" onConfirm={() => handleDelete(record.id)}>
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
          <div className="page-hero-title">云账号管理</div>
          <p className="page-hero-subtitle">管理多云平台的访问凭证和账号信息</p>
        </div>
        <div className="page-hero-actions">
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchAccounts}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setEditingId(null); setModalVisible(true) }}>
              添加账号
            </Button>
          </Space>
        </div>
      </div>

      <div className="metric-grid">
        <Card className="metric-card metric-card--primary" bordered={false}>
          <Statistic title="总账号数" value={total} prefix={<CloudOutlined style={{ color: '#0ea5e9' }} />} />
        </Card>
        <Card className="metric-card metric-card--success" bordered={false}>
          <Statistic title="正常" value={normalCount} prefix={<CheckCircleOutlined style={{ color: '#22c55e' }} />} />
        </Card>
        <Card className="metric-card metric-card--danger" bordered={false}>
          <Statistic title="异常" value={total - normalCount} prefix={<CloseCircleOutlined style={{ color: '#ef4444' }} />} />
        </Card>
      </div>

      <Card className="section-card" bordered={false}>
        <Table
          columns={columns}
          dataSource={accounts}
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
        title={editingId ? '编辑云账号' : '添加云账号'}
        open={modalVisible}
        onOk={handleCreate}
        onCancel={() => { setModalVisible(false); setEditingId(null) }}
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="账号名称" rules={[{ required: true, message: '请输入账号名称' }]}>
            <Input placeholder="如：生产环境-阿里云" />
          </Form.Item>
          <Form.Item name="provider" label="云提供商" rules={[{ required: true, message: '请选择云提供商' }]}>
            <Select placeholder="选择云提供商" options={providerOptions} disabled={!!editingId} />
          </Form.Item>
          {!editingId && (
            <>
              <Form.Item name="access_key" label="Access Key" rules={[{ required: true, message: '请输入 Access Key' }]}>
                <Input placeholder="Access Key ID" />
              </Form.Item>
              <Form.Item name="secret_key" label="Secret Key" rules={[{ required: true, message: '请输入 Secret Key' }]}>
                <Input.Password placeholder="Secret Key" />
              </Form.Item>
            </>
          )}
          <Form.Item name="region" label="默认区域">
            <Input placeholder="如：cn-hangzhou / us-east-1" />
          </Form.Item>
          <Form.Item name="description" label="备注">
            <Input.TextArea rows={2} placeholder="可选说明" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default AccountList
