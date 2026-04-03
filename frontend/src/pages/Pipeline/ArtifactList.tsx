import React, { useState, useEffect, useCallback } from 'react'
import {
  Card,
  Table,
  Tag,
  Button,
  message,
  Popconfirm,
  Statistic,
} from 'antd'
import {
  ReloadOutlined,
  DeleteOutlined,
  InboxOutlined,
  CloudOutlined,
  FileZipOutlined,
  CodeOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { pipelineV2Service, Artifact } from '@/services/pipeline_v2'

const typeMap: Record<string, { text: string; color: string; icon: React.ReactNode }> = {
  docker_image: { text: 'Docker 镜像', color: 'blue', icon: <CloudOutlined /> },
  binary: { text: '二进制', color: 'green', icon: <CodeOutlined /> },
  archive: { text: '归档包', color: 'orange', icon: <FileZipOutlined /> },
}

function formatSize(bytes: number): string {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

const ArtifactList: React.FC = () => {
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)

  const fetchArtifacts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await pipelineV2Service.listArtifacts({ page, page_size: pageSize })
      setArtifacts(res.data.list || [])
      setTotal(res.data.total || 0)
    } catch {
      message.error('获取制品列表失败')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize])

  useEffect(() => {
    fetchArtifacts()
  }, [fetchArtifacts])

  const handleDelete = async (id: string) => {
    try {
      await pipelineV2Service.deleteArtifact(id)
      message.success('删除成功')
      fetchArtifacts()
    } catch {
      message.error('删除失败')
    }
  }

  const dockerCount = artifacts.filter((a) => a.type === 'docker_image').length

  const columns: ColumnsType<Artifact> = [
    {
      title: '制品名称',
      dataIndex: 'name',
      key: 'name',
      width: 240,
      render: (v: string) => <strong>{v}</strong>,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (v: string) => {
        const cfg = typeMap[v] || { text: v, color: 'default', icon: <InboxOutlined /> }
        return <Tag icon={cfg.icon} color={cfg.color}>{cfg.text}</Tag>
      },
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 120,
      render: (v: string) => v ? <code>{v}</code> : '-',
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 100,
      render: (v: number) => formatSize(v),
    },
    {
      title: '仓库/路径',
      key: 'path',
      width: 280,
      ellipsis: true,
      render: (_, record) => record.registry || record.path || '-',
    },
    {
      title: 'Digest',
      dataIndex: 'digest',
      key: 'digest',
      width: 160,
      ellipsis: true,
      render: (v: string) => v ? <code style={{ fontSize: 11 }}>{v.slice(0, 16)}...</code> : '-',
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
      width: 80,
      render: (_, record) => (
        <Popconfirm title="确定删除此制品?" onConfirm={() => handleDelete(record.id)}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ]

  return (
    <div className="page-shell fade-in">
      <div className="page-hero">
        <div>
          <div className="page-hero-title">制品管理</div>
          <p className="page-hero-subtitle">管理流水线构建产出的 Docker 镜像、二进制和归档包</p>
        </div>
        <div className="page-hero-actions">
          <Button icon={<ReloadOutlined />} onClick={fetchArtifacts}>刷新</Button>
        </div>
      </div>

      <div className="metric-grid">
        <Card className="metric-card metric-card--primary" bordered={false}>
          <Statistic title="总制品数" value={total} prefix={<InboxOutlined style={{ color: '#0ea5e9' }} />} />
        </Card>
        <Card className="metric-card metric-card--success" bordered={false}>
          <Statistic title="Docker 镜像" value={dockerCount} prefix={<CloudOutlined style={{ color: '#22c55e' }} />} />
        </Card>
      </div>

      <Card className="section-card" bordered={false}>
        <Table
          columns={columns}
          dataSource={artifacts}
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
    </div>
  )
}

export default ArtifactList
