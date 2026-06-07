import React from 'react'
import { Button, Card, Col, Input, Row, Select, Space, Statistic, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  AppstoreOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileSearchOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons'

interface PlaceholderPageProps {
  title: string
  description: string
  items: string[]
}

interface ModuleRecord {
  key: string
  name: string
  scope: string
  owner: string
  status: 'normal' | 'warning' | 'pending'
  updatedAt: string
}

const statusMap = {
  normal: { text: '正常', color: 'success' },
  warning: { text: '关注', color: 'warning' },
  pending: { text: '待处理', color: 'processing' },
} as const

const buildRecords = (items: string[]): ModuleRecord[] =>
  items.map((item, index) => ({
    key: item,
    name: item,
    scope: index % 2 === 0 ? '生产环境' : '测试环境',
    owner: index % 2 === 0 ? '运维团队' : '研发团队',
    status: index === 1 ? 'warning' : index === 2 ? 'pending' : 'normal',
    updatedAt: `2026-06-0${Math.min(index + 3, 7)} 14:${String(20 + index * 7).padStart(2, '0')}`,
  }))

const PlaceholderPage: React.FC<PlaceholderPageProps> = ({ title, description, items }) => {
  const records = buildRecords(items)

  const columns: ColumnsType<ModuleRecord> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <Space>
          <AppstoreOutlined style={{ color: '#0ea5e9' }} />
          <span style={{ fontWeight: 600 }}>{name}</span>
        </Space>
      ),
    },
    { title: '范围', dataIndex: 'scope', key: 'scope', width: 130 },
    { title: '负责人', dataIndex: 'owner', key: 'owner', width: 130 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: ModuleRecord['status']) => (
        <Tag color={statusMap[status].color}>{statusMap[status].text}</Tag>
      ),
    },
    { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 170 },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: () => <Button type="link" size="small">查看</Button>,
    },
  ]

  return (
    <div className="module-page">
      <div className="page-hero compact">
        <div>
          <div className="page-hero-title">{title}</div>
          <p className="page-hero-subtitle">{description}</p>
        </div>
        <div className="page-hero-actions">
          <Button icon={<ReloadOutlined />}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />}>新建</Button>
        </div>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card className="metric-card metric-card--primary">
            <Statistic title="总数" value={records.length} prefix={<AppstoreOutlined />} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="metric-card metric-card--success">
            <Statistic title="正常" value={records.filter((item) => item.status === 'normal').length} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="metric-card metric-card--warning">
            <Statistic title="待关注" value={records.filter((item) => item.status !== 'normal').length} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card className="section-card">
        <div className="toolbar">
          <div className="toolbar-left">
            <Input.Search placeholder={`搜索${title}`} allowClear style={{ width: 260 }} />
            <Select
              placeholder="状态"
              allowClear
              style={{ width: 140 }}
              options={[
                { label: '正常', value: 'normal' },
                { label: '关注', value: 'warning' },
                { label: '待处理', value: 'pending' },
              ]}
            />
          </div>
          <div className="toolbar-right">
            <Button icon={<FileSearchOutlined />}>导出</Button>
          </div>
        </div>
        <Table
          rowKey="key"
          columns={columns}
          dataSource={records}
          pagination={false}
          scroll={{ x: 760 }}
        />
      </Card>
    </div>
  )
}

export default PlaceholderPage
