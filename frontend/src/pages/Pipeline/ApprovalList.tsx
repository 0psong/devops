import React, { useState, useEffect, useCallback } from 'react'
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  message,
  Statistic,
  Modal,
  Input,
} from 'antd'
import {
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  AuditOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { pipelineV2Service, PipelineRun } from '@/services/pipeline_v2'

const ApprovalList: React.FC = () => {
  const [approvals, setApprovals] = useState<PipelineRun[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(false)
  const [commentVisible, setCommentVisible] = useState(false)
  const [currentAction, setCurrentAction] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null)
  const [comment, setComment] = useState('')

  const fetchApprovals = useCallback(async () => {
    setLoading(true)
    try {
      const res = await pipelineV2Service.listPendingApprovals({ page, page_size: pageSize })
      setApprovals(res.data.list || [])
      setTotal(res.data.total || 0)
    } catch {
      message.error('获取待审批列表失败')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize])

  useEffect(() => {
    fetchApprovals()
  }, [fetchApprovals])

  const openAction = (id: string, action: 'approve' | 'reject') => {
    setCurrentAction({ id, action })
    setComment('')
    setCommentVisible(true)
  }

  const handleSubmit = async () => {
    if (!currentAction) return
    try {
      if (currentAction.action === 'approve') {
        await pipelineV2Service.approveRun(currentAction.id, comment)
        message.success('已审批通过')
      } else {
        await pipelineV2Service.rejectRun(currentAction.id, comment)
        message.success('已拒绝')
      }
      setCommentVisible(false)
      setCurrentAction(null)
      fetchApprovals()
    } catch {
      message.error('操作失败')
    }
  }

  const columns: ColumnsType<PipelineRun> = [
    {
      title: '流水线',
      key: 'pipeline',
      width: 200,
      render: (_, record) => record.definition?.name || '-',
    },
    {
      title: '运行编号',
      dataIndex: 'run_number',
      key: 'run_number',
      width: 100,
      render: (v: number) => `#${v}`,
    },
    {
      title: '分支',
      dataIndex: 'branch',
      key: 'branch',
      width: 120,
      render: (v: string) => v ? <code>{v}</code> : '-',
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: () => <Tag icon={<ExclamationCircleOutlined />} color="gold">待审批</Tag>,
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
      width: 160,
      render: (_, record) => (
        <Space>
          <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => openAction(record.id, 'approve')}>
            通过
          </Button>
          <Button size="small" danger icon={<CloseCircleOutlined />} onClick={() => openAction(record.id, 'reject')}>
            拒绝
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div className="page-shell fade-in">
      <div className="page-hero">
        <div>
          <div className="page-hero-title">待审批</div>
          <p className="page-hero-subtitle">审批流水线中的人工确认节点</p>
        </div>
        <div className="page-hero-actions">
          <Button icon={<ReloadOutlined />} onClick={fetchApprovals}>刷新</Button>
        </div>
      </div>

      <div className="metric-grid">
        <Card className="metric-card metric-card--warning" bordered={false}>
          <Statistic title="待审批" value={total} prefix={<AuditOutlined style={{ color: '#f59e0b' }} />} />
        </Card>
      </div>

      <Card className="section-card" bordered={false}>
        <Table
          columns={columns}
          dataSource={approvals}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps) },
          }}
          scroll={{ x: 900 }}
        />
      </Card>

      <Modal
        title={currentAction?.action === 'approve' ? '审批通过' : '审批拒绝'}
        open={commentVisible}
        onOk={handleSubmit}
        onCancel={() => setCommentVisible(false)}
        okText={currentAction?.action === 'approve' ? '确认通过' : '确认拒绝'}
        okButtonProps={{ danger: currentAction?.action === 'reject' }}
      >
        <Input.TextArea
          rows={3}
          placeholder="审批意见（可选）"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          style={{ marginTop: 8 }}
        />
      </Modal>
    </div>
  )
}

export default ApprovalList
