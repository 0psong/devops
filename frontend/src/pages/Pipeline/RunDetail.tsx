import React, { useState, useEffect, useCallback } from 'react'
import {
  Card,
  Tag,
  Button,
  Space,
  Steps,
  Timeline,
  Descriptions,
  message,
  Spin,
  Input,
} from 'antd'
import {
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  StopOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { pipelineV2Service, PipelineRun, StageRun, StepRun } from '@/services/pipeline_v2'

const statusConfig: Record<string, { text: string; color: string; icon: React.ReactNode }> = {
  pending: { text: '等待中', color: 'default', icon: <ClockCircleOutlined /> },
  running: { text: '运行中', color: 'processing', icon: <SyncOutlined spin /> },
  success: { text: '成功', color: 'success', icon: <CheckCircleOutlined /> },
  failed: { text: '失败', color: 'error', icon: <CloseCircleOutlined /> },
  cancelled: { text: '已取消', color: 'warning', icon: <StopOutlined /> },
  waiting_approval: { text: '待审批', color: 'gold', icon: <ExclamationCircleOutlined /> },
}

const RunDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [run, setRun] = useState<PipelineRun | null>(null)
  const [stages, setStages] = useState<StageRun[]>([])
  const [loading, setLoading] = useState(false)
  const [stepLogs, setStepLogs] = useState<Record<string, string>>({})
  const [approvalComment, setApprovalComment] = useState('')

  const fetchRun = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [runRes, stagesRes] = await Promise.all([
        pipelineV2Service.getRun(id),
        pipelineV2Service.getStages(id),
      ])
      setRun(runRes.data)
      setStages(stagesRes.data || [])
    } catch {
      message.error('获取运行详情失败')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchRun()
  }, [fetchRun])

  const loadStepLog = async (runId: string, stepId: string) => {
    try {
      const res = await pipelineV2Service.getStepLog(runId, stepId)
      setStepLogs((prev) => ({ ...prev, [stepId]: res.data?.log || '暂无日志' }))
    } catch {
      setStepLogs((prev) => ({ ...prev, [stepId]: '获取日志失败' }))
    }
  }

  const handleCancel = async () => {
    if (!id) return
    try {
      await pipelineV2Service.cancelRun(id)
      message.success('已取消')
      fetchRun()
    } catch {
      message.error('取消失败')
    }
  }

  const handleRetry = async () => {
    if (!id) return
    try {
      await pipelineV2Service.retryRun(id)
      message.success('已重试')
      fetchRun()
    } catch {
      message.error('重试失败')
    }
  }

  const handleApprove = async () => {
    if (!id) return
    try {
      await pipelineV2Service.approveRun(id, approvalComment)
      message.success('已审批通过')
      setApprovalComment('')
      fetchRun()
    } catch {
      message.error('审批失败')
    }
  }

  const handleReject = async () => {
    if (!id) return
    try {
      await pipelineV2Service.rejectRun(id, approvalComment)
      message.success('已拒绝')
      setApprovalComment('')
      fetchRun()
    } catch {
      message.error('操作失败')
    }
  }

  const getStepStatus = (status: string) => {
    if (status === 'success') return 'finish' as const
    if (status === 'running') return 'process' as const
    if (status === 'failed') return 'error' as const
    return 'wait' as const
  }

  if (loading && !run) {
    return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
  }

  if (!run) {
    return <div style={{ textAlign: 'center', padding: 60 }}>运行记录不存在</div>
  }

  const cfg = statusConfig[run.status] || statusConfig.pending

  return (
    <div className="page-shell fade-in">
      <div className="page-hero">
        <div>
          <div className="page-hero-title">运行详情 #{run.run_number}</div>
          <p className="page-hero-subtitle">{run.definition?.name || '流水线运行'}</p>
        </div>
        <div className="page-hero-actions">
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchRun}>刷新</Button>
            {run.status === 'running' && (
              <Button danger onClick={handleCancel}>取消运行</Button>
            )}
            {run.status === 'failed' && (
              <Button type="primary" onClick={handleRetry}>重试</Button>
            )}
            <Button onClick={() => navigate(-1)}>返回</Button>
          </Space>
        </div>
      </div>

      <Card className="section-card" bordered={false} style={{ marginBottom: 16 }}>
        <Descriptions column={4} size="small">
          <Descriptions.Item label="状态">
            <Tag icon={cfg.icon} color={cfg.color}>{cfg.text}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="分支">{run.branch ? <code>{run.branch}</code> : '-'}</Descriptions.Item>
          <Descriptions.Item label="耗时">{run.duration ? `${run.duration}s` : '-'}</Descriptions.Item>
          <Descriptions.Item label="触发方式">{run.trigger_type || 'manual'}</Descriptions.Item>
          <Descriptions.Item label="Commit">{run.commit_id ? <code>{run.commit_id.slice(0, 8)}</code> : '-'}</Descriptions.Item>
          <Descriptions.Item label="开始时间">{run.started_at ? dayjs(run.started_at).format('YYYY-MM-DD HH:mm:ss') : '-'}</Descriptions.Item>
          <Descriptions.Item label="结束时间">{run.finished_at ? dayjs(run.finished_at).format('YYYY-MM-DD HH:mm:ss') : '-'}</Descriptions.Item>
        </Descriptions>
      </Card>

      {run.status === 'waiting_approval' && (
        <Card className="section-card" bordered={false} style={{ marginBottom: 16 }}>
          <h4 style={{ marginBottom: 12 }}>审批操作</h4>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Input.TextArea
              rows={2}
              placeholder="审批意见（可选）"
              value={approvalComment}
              onChange={(e) => setApprovalComment(e.target.value)}
            />
            <Space>
              <Button type="primary" onClick={handleApprove}>通过</Button>
              <Button danger onClick={handleReject}>拒绝</Button>
            </Space>
          </Space>
        </Card>
      )}

      <Card className="section-card" bordered={false} style={{ marginBottom: 16 }}>
        <h4 style={{ marginBottom: 16 }}>阶段进度</h4>
        <Steps
          size="small"
          current={stages.findIndex((s) => s.status === 'running')}
          items={stages.map((s) => ({
            title: s.name,
            status: getStepStatus(s.status),
            description: s.type === 'approval' ? '审批' : s.env_code || undefined,
          }))}
        />
      </Card>

      <Card className="section-card" bordered={false}>
        <h4 style={{ marginBottom: 16 }}>执行日志</h4>
        <Timeline
          items={stages.map((stage) => ({
            color: stage.status === 'success' ? 'green' : stage.status === 'failed' ? 'red' : stage.status === 'running' ? 'blue' : 'gray',
            children: (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>
                  {stage.name}
                  <Tag color={statusConfig[stage.status]?.color || 'default'} style={{ marginLeft: 8 }}>
                    {statusConfig[stage.status]?.text || stage.status}
                  </Tag>
                  {stage.duration > 0 && <span style={{ color: '#8c8c8c', marginLeft: 8 }}>{stage.duration}s</span>}
                </div>
                {(stage.steps || []).map((step: StepRun) => (
                  <div key={step.id} style={{ marginLeft: 16, marginBottom: 8 }}>
                    <Space>
                      <Tag>{step.type}</Tag>
                      <span>{step.name}</span>
                      <Tag color={statusConfig[step.status]?.color || 'default'} style={{ fontSize: 11 }}>
                        {statusConfig[step.status]?.text || step.status}
                      </Tag>
                      {step.status !== 'pending' && (
                        <a onClick={() => loadStepLog(id!, step.id)} style={{ fontSize: 12 }}>查看日志</a>
                      )}
                    </Space>
                    {stepLogs[step.id] && (
                      <pre style={{
                        background: '#1a1a2e',
                        color: '#e0e0e0',
                        padding: 12,
                        borderRadius: 6,
                        fontSize: 12,
                        maxHeight: 200,
                        overflow: 'auto',
                        whiteSpace: 'pre-wrap',
                        marginTop: 4,
                      }}>
                        {stepLogs[step.id]}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            ),
          }))}
        />
      </Card>
    </div>
  )
}

export default RunDetail
