import { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  message,
  Tag,
  Descriptions,
  Row,
  Col,
  Statistic,
} from 'antd'
import {
  SearchOutlined,
  ExportOutlined,
  EyeOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  getAuditLogs,
  getAuditLog,
  getAuditStats,
  exportAuditLogs,
  AuditLog,
  AuditStats,
  AuditQueryParams,
  ActionLabels,
  ModuleLabels,
} from '@/services/audit'

const { RangePicker } = DatePicker

export default function AuditLogList() {
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // 查询条件
  const [filters, setFilters] = useState<AuditQueryParams>({})
  const [form] = Form.useForm()

  // 详情弹窗
  const [detailVisible, setDetailVisible] = useState(false)
  const [currentLog, setCurrentLog] = useState<AuditLog | null>(null)

  // 统计数据
  const [stats, setStats] = useState<AuditStats | null>(null)
  const [statsVisible, setStatsVisible] = useState(false)

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const res = await getAuditLogs({
        page,
        page_size: pageSize,
        ...filters,
      })
      if (res.code === 0) {
        setLogs(res.data.list || [])
        setTotal(res.data.total)
      }
    } catch (e) {
      message.error('获取审计日志失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [page, pageSize, filters])

  const handleSearch = () => {
    const values = form.getFieldsValue()
    const newFilters: AuditQueryParams = {}

    if (values.username) newFilters.username = values.username
    if (values.module) newFilters.module = values.module
    if (values.action) newFilters.action = values.action
    if (values.status !== undefined) newFilters.status = values.status
    if (values.ip) newFilters.ip = values.ip
    if (values.keyword) newFilters.keyword = values.keyword
    if (values.dateRange?.length === 2) {
      newFilters.start_time = values.dateRange[0].format('YYYY-MM-DD')
      newFilters.end_time = values.dateRange[1].format('YYYY-MM-DD')
    }

    setFilters(newFilters)
    setPage(1)
  }

  const handleReset = () => {
    form.resetFields()
    setFilters({})
    setPage(1)
  }

  const handleViewDetail = async (record: AuditLog) => {
    try {
      const res = await getAuditLog(record.id)
      if (res.code === 0) {
        setCurrentLog(res.data)
        setDetailVisible(true)
      }
    } catch (e) {
      message.error('获取详情失败')
    }
  }

  const handleExport = async () => {
    try {
      const blob = await exportAuditLogs(filters)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit_logs_${dayjs().format('YYYYMMDD')}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
      message.success('导出成功')
    } catch (e) {
      message.error('导出失败')
    }
  }

  const handleShowStats = async () => {
    try {
      const params: { start_time?: string; end_time?: string } = {}
      if (filters.start_time) params.start_time = filters.start_time
      if (filters.end_time) params.end_time = filters.end_time

      const res = await getAuditStats(params)
      if (res.code === 0) {
        setStats(res.data)
        setStatsVisible(true)
      }
    } catch (e) {
      message.error('获取统计失败')
    }
  }

  const columns: ColumnsType<AuditLog> = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '用户',
      dataIndex: 'username',
      key: 'username',
      width: 100,
    },
    {
      title: '模块',
      dataIndex: 'module',
      key: 'module',
      width: 100,
      render: (m: string) => (
        <Tag color="blue">{ModuleLabels[m] || m}</Tag>
      ),
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      width: 80,
      render: (a: string) => {
        const colors: Record<string, string> = {
          create: 'green',
          update: 'orange',
          delete: 'red',
          view: 'default',
          execute: 'purple',
        }
        return <Tag color={colors[a] || 'default'}>{ActionLabels[a] || a}</Tag>
      },
    },
    {
      title: '资源',
      key: 'resource',
      ellipsis: true,
      render: (_, record) => record.resource_name || record.resource_id || '-',
    },
    {
      title: 'IP',
      dataIndex: 'ip',
      key: 'ip',
      width: 130,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (s: number) => (
        <Tag color={s === 1 ? 'success' : 'error'}>
          {s === 1 ? '成功' : '失败'}
        </Tag>
      ),
    },
    {
      title: '耗时',
      dataIndex: 'duration',
      key: 'duration',
      width: 80,
      render: (d: number) => (d ? `${d}ms` : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetail(record)}
        >
          详情
        </Button>
      ),
    },
  ]

  return (
    <Card
      title="审计日志"
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchLogs}>
            刷新
          </Button>
          <Button onClick={handleShowStats}>统计分析</Button>
          <Button icon={<ExportOutlined />} onClick={handleExport}>
            导出CSV
          </Button>
        </Space>
      }
    >
      {/* 搜索表单 */}
      <Form form={form} style={{ marginBottom: 16 }}>
        <Row gutter={[16, 12]}>
          <Col span={4}>
            <Form.Item name="username" style={{ marginBottom: 0 }}>
              <Input placeholder="用户名" />
            </Form.Item>
          </Col>
          <Col span={4}>
            <Form.Item name="module" style={{ marginBottom: 0 }}>
              <Select
                placeholder="模块"
                allowClear
                options={Object.entries(ModuleLabels).map(([k, v]) => ({
                  value: k,
                  label: v,
                }))}
              />
            </Form.Item>
          </Col>
          <Col span={3}>
            <Form.Item name="action" style={{ marginBottom: 0 }}>
              <Select
                placeholder="操作"
                allowClear
                options={Object.entries(ActionLabels).map(([k, v]) => ({
                  value: k,
                  label: v,
                }))}
              />
            </Form.Item>
          </Col>
          <Col span={3}>
            <Form.Item name="status" style={{ marginBottom: 0 }}>
              <Select
                placeholder="状态"
                allowClear
                options={[
                  { value: 1, label: '成功' },
                  { value: 0, label: '失败' },
                ]}
              />
            </Form.Item>
          </Col>
          <Col span={4}>
            <Form.Item name="ip" style={{ marginBottom: 0 }}>
              <Input placeholder="IP地址" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="dateRange" style={{ marginBottom: 0 }}>
              <RangePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={4}>
            <Form.Item name="keyword" style={{ marginBottom: 0 }}>
              <Input placeholder="关键字" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Space>
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                搜索
              </Button>
              <Button onClick={handleReset}>重置</Button>
            </Space>
          </Col>
        </Row>
      </Form>

      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={logs}
        size="small"
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

      {/* 详情弹窗 */}
      <Modal
        title="日志详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={700}
      >
        {currentLog && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="ID">{currentLog.id}</Descriptions.Item>
            <Descriptions.Item label="追踪ID">{currentLog.trace_id || '-'}</Descriptions.Item>
            <Descriptions.Item label="时间">
              {dayjs(currentLog.created_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="耗时">{currentLog.duration}ms</Descriptions.Item>
            <Descriptions.Item label="用户">{currentLog.username}</Descriptions.Item>
            <Descriptions.Item label="IP">{currentLog.ip}</Descriptions.Item>
            <Descriptions.Item label="模块">
              {ModuleLabels[currentLog.module] || currentLog.module}
            </Descriptions.Item>
            <Descriptions.Item label="操作">
              {ActionLabels[currentLog.action] || currentLog.action}
            </Descriptions.Item>
            <Descriptions.Item label="资源路径" span={2}>
              {currentLog.resource}
            </Descriptions.Item>
            <Descriptions.Item label="资源ID">{currentLog.resource_id}</Descriptions.Item>
            <Descriptions.Item label="资源名称">{currentLog.resource_name}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={currentLog.status === 1 ? 'success' : 'error'}>
                {currentLog.status === 1 ? '成功' : '失败'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="错误信息">
              {currentLog.error_message || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="User-Agent" span={2}>
              {currentLog.user_agent}
            </Descriptions.Item>
            {currentLog.old_value && (
              <Descriptions.Item label="修改前" span={2}>
                <pre style={{ maxHeight: 150, overflow: 'auto', margin: 0 }}>
                  {currentLog.old_value}
                </pre>
              </Descriptions.Item>
            )}
            {currentLog.new_value && (
              <Descriptions.Item label="修改后/请求内容" span={2}>
                <pre style={{ maxHeight: 150, overflow: 'auto', margin: 0 }}>
                  {currentLog.new_value}
                </pre>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>

      {/* 统计弹窗 */}
      <Modal
        title="统计分析"
        open={statsVisible}
        onCancel={() => setStatsVisible(false)}
        footer={null}
        width={800}
      >
        {stats && (
          <>
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col span={8}>
                <Statistic title="总操作数" value={stats.total_count} />
              </Col>
              <Col span={8}>
                <Statistic
                  title="成功"
                  value={stats.success_count}
                  valueStyle={{ color: '#3f8600' }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="失败"
                  value={stats.failed_count}
                  valueStyle={{ color: '#cf1322' }}
                />
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Card title="按操作类型" size="small">
                  {Object.entries(stats.action_counts).map(([action, count]) => (
                    <div key={action} style={{ marginBottom: 8 }}>
                      <span>{ActionLabels[action] || action}: </span>
                      <Tag>{count}</Tag>
                    </div>
                  ))}
                </Card>
              </Col>
              <Col span={12}>
                <Card title="按模块" size="small">
                  {Object.entries(stats.module_counts).map(([module, count]) => (
                    <div key={module} style={{ marginBottom: 8 }}>
                      <span>{ModuleLabels[module] || module}: </span>
                      <Tag>{count}</Tag>
                    </div>
                  ))}
                </Card>
              </Col>
            </Row>

            {stats.top_users?.length > 0 && (
              <Card title="活跃用户 TOP10" size="small" style={{ marginTop: 16 }}>
                {stats.top_users.map((user, index) => (
                  <div key={user.user_id} style={{ marginBottom: 4 }}>
                    <span>{index + 1}. {user.username}: </span>
                    <Tag color="blue">{user.count} 次操作</Tag>
                  </div>
                ))}
              </Card>
            )}
          </>
        )}
      </Modal>
    </Card>
  )
}
