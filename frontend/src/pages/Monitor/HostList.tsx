import React, { useState, useEffect } from 'react'
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
  InputNumber,
  Card,
  Row,
  Col,
  Statistic,
  Tooltip,
} from 'antd'
import {
  PlusOutlined,
  ReloadOutlined,
  ApiOutlined,
  DesktopOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { hostService, Host, HostGroup } from '@/services/host'

const HostList: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [hosts, setHosts] = useState<Host[]>([])
  const [groups, setGroups] = useState<HostGroup[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingHost, setEditingHost] = useState<Host | null>(null)
  const [keyword, setKeyword] = useState('')
  const [authType, setAuthType] = useState('password')
  const [form] = Form.useForm()

  const fetchHosts = async () => {
    setLoading(true)
    try {
      const res = await hostService.list({ page, page_size: pageSize, keyword: keyword || undefined })
      setHosts(res.data.list || [])
      setTotal(res.data.total)
    } catch {
      message.error('获取主机列表失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchGroups = async () => {
    try {
      const res = await hostService.listGroups()
      setGroups(res.data || [])
    } catch {
      message.error('获取分组列表失败')
    }
  }

  useEffect(() => {
    fetchHosts()
    fetchGroups()
  }, [page, pageSize, keyword])

  const handleAdd = () => {
    setEditingHost(null)
    form.resetFields()
    form.setFieldsValue({ port: 22, auth_type: 'password' })
    setModalVisible(true)
  }

  const handleEdit = (record: Host) => {
    setEditingHost(record)
    form.setFieldsValue(record)
    setModalVisible(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await hostService.delete(id)
      message.success('删除成功')
      fetchHosts()
    } catch {
      message.error('删除失败')
    }
  }

  const handleTestConnection = async (id: string) => {
    try {
      await hostService.testConnection(id)
      message.success('连接成功')
      fetchHosts()
    } catch {
      message.error('连接测试失败')
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editingHost) {
        await hostService.update(editingHost.id, values)
        message.success('更新成功')
      } else {
        await hostService.create(values)
        message.success('创建成功')
      }
      setModalVisible(false)
      fetchHosts()
    } catch {
      message.error('提交失败')
    }
  }

  const onlineCount = hosts.filter((h) => h.status === 1).length
  const offlineCount = hosts.filter((h) => h.status === 0).length

  const columns: ColumnsType<Host> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 160,
      render: (name: string, record: Host) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: record.status === 1
              ? 'linear-gradient(135deg, rgba(17, 153, 142, 0.1) 0%, rgba(56, 239, 125, 0.1) 100%)'
              : 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(248, 113, 113, 0.1) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <DesktopOutlined style={{
              fontSize: 18,
              color: record.status === 1 ? '#11998e' : '#ef4444'
            }} />
          </div>
          <span style={{ fontWeight: 600, color: '#1a1a2e' }}>{name}</span>
        </div>
      ),
    },
    {
      title: 'IP 地址',
      dataIndex: 'ip',
      key: 'ip',
      width: 150,
      render: (ip: string) => <code>{ip}</code>,
    },
    {
      title: '端口',
      dataIndex: 'port',
      key: 'port',
      width: 80,
      render: (port: number) => <span style={{ color: '#8c8c8c' }}>{port}</span>,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      width: 100,
      render: (username: string) => <span style={{ color: '#5c5c6d' }}>{username}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: number) => (
        status === 1 ? (
          <Tag
            icon={<CheckCircleOutlined />}
            style={{
              background: '#ecfdf5',
              borderColor: '#a7f3d0',
              color: '#059669',
              borderRadius: 6,
              padding: '2px 10px',
            }}
          >
            在线
          </Tag>
        ) : status === 0 ? (
          <Tag
            icon={<CloseCircleOutlined />}
            style={{
              background: '#fef2f2',
              borderColor: '#fecaca',
              color: '#dc2626',
              borderRadius: 6,
              padding: '2px 10px',
            }}
          >
            离线
          </Tag>
        ) : (
          <Tag style={{ borderRadius: 6, padding: '2px 10px' }}>未知</Tag>
        )
      ),
    },
    {
      title: '分组',
      dataIndex: 'group',
      key: 'group',
      width: 120,
      render: (group: HostGroup) => group?.name ? (
        <Tag style={{
          background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.12) 0%, rgba(20, 184, 166, 0.12) 100%)',
          borderColor: 'rgba(14, 165, 233, 0.35)',
          color: '#0284c7',
          borderRadius: 6,
          padding: '2px 10px',
        }}>
          {group.name}
        </Tag>
      ) : <span style={{ color: '#bfbfbf' }}>-</span>,
    },
    {
      title: '操作系统',
      dataIndex: 'os',
      key: 'os',
      width: 130,
      render: (os: string) => <span style={{ color: '#8c8c8c' }}>{os || '-'}</span>,
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="测试连接">
            <Button
              type="text"
              size="small"
              icon={<ApiOutlined />}
              onClick={() => handleTestConnection(record.id)}
              style={{ color: '#0ea5e9' }}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
              style={{ color: '#8c8c8c' }}
            />
          </Tooltip>
          <Popconfirm
            title="确定删除此主机?"
            description="删除后无法恢复"
            onConfirm={() => handleDelete(record.id)}
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="删除">
              <Button
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                style={{ color: '#8c8c8c' }}
              />
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
          <div className="page-hero-title">主机管理</div>
          <p className="page-hero-subtitle">管理和监控所有服务器资源</p>
        </div>
        <div className="page-hero-actions">
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加主机
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchHosts}>
            刷新
          </Button>
        </div>
      </div>

      <div className="metric-grid">
        <Card bordered={false} className="metric-card metric-card--primary">
          <Statistic
            title="主机总数"
            value={total}
            prefix={<DesktopOutlined style={{ color: '#0ea5e9', marginRight: 8 }} />}
          />
        </Card>
        <Card bordered={false} className="metric-card metric-card--success">
          <Statistic
            title="在线"
            value={onlineCount}
            prefix={<CheckCircleOutlined style={{ color: '#22c55e', marginRight: 8 }} />}
          />
        </Card>
        <Card bordered={false} className="metric-card metric-card--danger">
          <Statistic
            title="离线"
            value={offlineCount}
            prefix={<CloseCircleOutlined style={{ color: '#ef4444', marginRight: 8 }} />}
          />
        </Card>
      </div>

      <Card className="section-card" bordered={false}>
        <div className="toolbar">
          <div className="toolbar-left">
            <Input.Search
              placeholder="搜索主机..."
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              style={{ width: 240 }}
              allowClear
              onSearch={(v) => { setPage(1); setKeyword(v) }}
            />
          </div>
          <div className="toolbar-right" />
        </div>

        <Table
          columns={columns}
          dataSource={hosts}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps) },
          }}
        />
      </Card>

      <Modal
        title={editingHost ? '编辑主机' : '添加主机'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={640}
        okText="确定"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 20 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入主机名称' }]}>
                <Input placeholder="主机名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ip" label="IP 地址" rules={[{ required: true, message: '请输入 IP 地址' }]}>
                <Input placeholder="192.168.1.1" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="port" label="SSH 端口">
                <InputNumber min={1} max={65535} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="username" label="用户名">
                <Input placeholder="root" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="auth_type" label="认证方式">
                <Select onChange={(v) => setAuthType(v)}>
                  <Select.Option value="password">密码</Select.Option>
                  <Select.Option value="key">密钥</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          {authType === 'password' ? (
            <Form.Item name="password" label="密码">
              <Input.Password placeholder="SSH 密码" />
            </Form.Item>
          ) : (
            <Form.Item name="private_key" label="私钥">
              <Input.TextArea rows={4} placeholder="粘贴 SSH 私钥内容" />
            </Form.Item>
          )}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="group_id" label="分组">
                <Select allowClear placeholder="选择分组">
                  {groups.map((g) => (
                    <Select.Option key={g.id} value={g.id}>{g.name}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="os" label="操作系统">
                <Input placeholder="CentOS 7" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="主机描述信息..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default HostList
