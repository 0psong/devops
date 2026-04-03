import React, { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Tag,
  Select,
  Space,
  Button,
  Statistic,
  Input,
  Drawer,
  Descriptions,
  Tabs,
  Spin,
  Modal,
  message,
  Tooltip,
} from 'antd'
import {
  ReloadOutlined,
  ContainerOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { k8sService, Cluster, K8sResource, K8sNamespace, K8sYamlHistory } from '@/services/k8s'
import YamlDiffViewer from '@/components/YamlDiffViewer'
import YamlHistoryModal from '@/components/YamlHistoryModal'

const PodList: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [selectedCluster, setSelectedCluster] = useState<string>('')
  const [namespaces, setNamespaces] = useState<K8sNamespace[]>([])
  const [selectedNs, setSelectedNs] = useState<string>('')
  const [pods, setPods] = useState<K8sResource[]>([])
  const [keyword, setKeyword] = useState('')
  const [detailVisible, setDetailVisible] = useState(false)
  const [currentPod, setCurrentPod] = useState<K8sResource | null>(null)
  const [detailTab, setDetailTab] = useState<'detail' | 'yaml' | 'logs'>('detail')
  const [detailYaml, setDetailYaml] = useState('')
  const [detailYamlLoading, setDetailYamlLoading] = useState(false)
  const [yamlVisible, setYamlVisible] = useState(false)
  const [yamlEditorLoading, setYamlEditorLoading] = useState(false)
  const [yamlEditorText, setYamlEditorText] = useState('')
  const [yamlTarget, setYamlTarget] = useState<{ name: string; namespace: string } | null>(null)
  const [yamlOriginal, setYamlOriginal] = useState('')
  const [diffVisible, setDiffVisible] = useState(false)
  const [historyVisible, setHistoryVisible] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyItems, setHistoryItems] = useState<K8sYamlHistory[]>([])
  const [logText, setLogText] = useState('')
  const [logLoading, setLogLoading] = useState(false)
  const [logContainer, setLogContainer] = useState<string>('')
  const [containers, setContainers] = useState<string[]>([])
  const [logTailLines, setLogTailLines] = useState(200)
  const [logPrevious] = useState(false)

  const fetchClusters = async () => {
    try {
      const res = await k8sService.listClusters({ page: 1, page_size: 100 })
      const list = res.data.list || []
      setClusters(list)
      if (list.length > 0) setSelectedCluster(list[0].id)
    } catch {
      message.error('获取数据失败')
    }
  }

  const fetchNamespaces = async () => {
    if (!selectedCluster) return
    try {
      const res = await k8sService.getNamespaces(selectedCluster)
      setNamespaces(res.data || [])
    } catch {
      message.error('获取数据失败')
    }
  }

  const fetchPods = async () => {
    if (!selectedCluster) return
    setLoading(true)
    try {
      const res = await k8sService.getPods(selectedCluster, selectedNs)
      setPods(res.data || [])
    } catch {
      message.error('获取数据失败')
    }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchClusters() }, [])
  useEffect(() => { if (selectedCluster) { fetchNamespaces(); fetchPods() } }, [selectedCluster])
  useEffect(() => { if (selectedCluster) fetchPods() }, [selectedNs])

  const filtered = pods.filter((p) =>
    !keyword || p.name.toLowerCase().includes(keyword.toLowerCase())
  )

  const runningCount = pods.filter((p) => p.status === 'Running').length
  const pendingCount = pods.filter((p) => p.status === 'Pending').length
  const failedCount = pods.filter((p) => p.status === 'Failed' || p.status === 'CrashLoopBackOff').length

  const loadDetailYaml = async (force = false) => {
    if (!currentPod || !selectedCluster) return
    if (detailYaml && !force) return
    setDetailYamlLoading(true)
    try {
      const res = await k8sService.getYaml(selectedCluster, { kind: 'Pod', name: currentPod.name, namespace: currentPod.namespace })
      setDetailYaml(res.data || '')
    } catch {
      message.error('获取 YAML 失败')
    } finally {
      setDetailYamlLoading(false)
    }
  }

  const fetchContainers = async (pod: K8sResource) => {
    if (!selectedCluster) return
    try {
      const res = await k8sService.getPodContainers(selectedCluster, { pod: pod.name, namespace: pod.namespace })
      const list = res.data || []
      setContainers(list)
      if (list.length > 0) setLogContainer(list[0])
    } catch {
      message.error('获取容器列表失败')
    }
  }

  const fetchPodLogs = async (pod?: K8sResource) => {
    const target = pod || currentPod
    if (!target || !selectedCluster) return
    setLogLoading(true)
    try {
      const res = await k8sService.getPodLogs(selectedCluster, {
        pod: target.name,
        namespace: target.namespace,
        container: logContainer || undefined,
        tail: logTailLines,
        previous: logPrevious,
      })
      setLogText(res.data || '暂无日志')
    } catch {
      message.error('获取日志失败')
    } finally {
      setLogLoading(false)
    }
  }

  const openYamlEditor = async (record: K8sResource) => {
    if (!selectedCluster) {
      message.warning('请先选择集群')
      return
    }
    setYamlVisible(true)
    setYamlTarget({ name: record.name, namespace: record.namespace })
    setYamlEditorText('')
    setYamlOriginal('')
    setDiffVisible(false)
    setYamlEditorLoading(true)
    try {
      const res = await k8sService.getYaml(selectedCluster, { kind: 'Pod', name: record.name, namespace: record.namespace })
      setYamlEditorText(res.data || '')
      setYamlOriginal(res.data || '')
    } catch {
      message.error('获取 YAML 失败')
    } finally {
      setYamlEditorLoading(false)
    }
  }

  const openHistory = async () => {
    if (!selectedCluster || !yamlTarget) {
      message.warning('请先选择资源')
      return
    }
    setHistoryVisible(true)
    setHistoryLoading(true)
    try {
      const res = await k8sService.getYamlHistory(selectedCluster, {
        kind: 'Pod',
        name: yamlTarget.name,
        namespace: yamlTarget.namespace,
        limit: 20,
      })
      setHistoryItems(res.data || [])
    } catch {
      message.error('获取历史版本失败')
    } finally {
      setHistoryLoading(false)
    }
  }

  const handleHistoryRestore = (yaml: string) => {
    setYamlEditorText(yaml)
    setHistoryVisible(false)
  }

  const handleHistoryRollback = (yaml: string) => {
    if (!selectedCluster) return
    Modal.confirm({
      title: '确认回滚并应用？',
      content: '将使用历史版本覆盖当前资源配置。',
      okText: '回滚并应用',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        await k8sService.applyYaml(selectedCluster, { yaml, action: 'rollback' })
        message.success('已回滚并应用')
        setHistoryVisible(false)
        setYamlVisible(false)
        fetchPods()
      },
    })
  }

  const formatYamlEdit = async () => {
    if (!selectedCluster) {
      message.warning('请先选择集群')
      return
    }
    if (!yamlEditorText.trim()) {
      message.error('请输入 YAML 内容')
      return
    }
    setYamlEditorLoading(true)
    try {
      const res = await k8sService.formatYaml(selectedCluster, { yaml: yamlEditorText })
      setYamlEditorText(res.data || '')
      message.success('已格式化')
    } catch {
      message.error('操作失败')
    }
    finally { setYamlEditorLoading(false) }
  }

  const validateYamlEdit = async () => {
    if (!selectedCluster) {
      message.warning('请先选择集群')
      return
    }
    if (!yamlEditorText.trim()) {
      message.error('请输入 YAML 内容')
      return
    }
    setYamlEditorLoading(true)
    try {
      await k8sService.applyYaml(selectedCluster, { yaml: yamlEditorText, dry_run: true })
      message.success('校验通过')
    } catch {
      message.error('操作失败')
    }
    finally { setYamlEditorLoading(false) }
  }

  const applyYamlEdit = async () => {
    if (!selectedCluster) {
      message.warning('请先选择集群')
      return
    }
    if (!yamlEditorText.trim()) {
      message.error('请输入 YAML 内容')
      return
    }
    setYamlEditorLoading(true)
    try {
      await k8sService.applyYaml(selectedCluster, { yaml: yamlEditorText })
      message.success('YAML 已应用')
      setYamlVisible(false)
      fetchPods()
    } catch {
      message.error('操作失败')
    }
    finally { setYamlEditorLoading(false) }
  }

  const columns: ColumnsType<K8sResource> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 320,
      ellipsis: true,
      render: (name: string, record) => (
        <Tooltip title={name}>
          <a onClick={() => { setCurrentPod(record); setDetailTab('detail'); setDetailYaml(''); setDetailVisible(true) }}>
            {name}
          </a>
        </Tooltip>
      ),
    },
    { title: '命名空间', dataIndex: 'namespace', key: 'namespace', width: 140 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (s: string) => {
        const colorMap: Record<string, string> = {
          Running: 'green',
          Pending: 'orange',
          Succeeded: 'blue',
          Failed: 'red',
          CrashLoopBackOff: 'red',
          ContainerCreating: 'cyan',
          Terminating: 'default',
        }
        return <Tag color={colorMap[s] || 'default'}>{s}</Tag>
      },
    },
    {
      title: '副本',
      key: 'replicas',
      width: 80,
      render: (_, r) => (
        <span style={{ color: r.ready === r.replicas ? '#52c41a' : '#faad14' }}>
          {r.ready}/{r.replicas}
        </span>
      ),
    },
    {
      title: '镜像',
      dataIndex: 'images',
      key: 'images',
      ellipsis: true,
      render: (images: string[]) => images?.join(', ') || '-',
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
      width: 120,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => {
            setCurrentPod(record)
            setDetailTab('logs')
            setDetailYaml('')
            setLogText('')
            setDetailVisible(true)
            fetchContainers(record)
            fetchPodLogs(record)
          }}>日志</Button>
          <Button type="link" size="small" onClick={() => openYamlEditor(record)}>YAML</Button>
        </Space>
      ),
    },
  ]

  return (
    <div className="page-shell fade-in">
      <div className="page-hero">
        <div>
          <div className="page-hero-title">容器组</div>
          <p className="page-hero-subtitle">跨集群查看和管理 Kubernetes Pod 资源</p>
        </div>
        <div className="page-hero-actions">
          <Button icon={<ReloadOutlined />} onClick={fetchPods}>刷新</Button>
        </div>
      </div>

      <div className="metric-grid">
        <Card className="metric-card metric-card--primary" bordered={false}>
          <Statistic title="Pod 总数" value={pods.length} prefix={<ContainerOutlined style={{ color: '#0ea5e9' }} />} />
        </Card>
        <Card className="metric-card metric-card--success" bordered={false}>
          <Statistic title="Running" value={runningCount} prefix={<CheckCircleOutlined style={{ color: '#22c55e' }} />} />
        </Card>
        <Card className="metric-card metric-card--warning" bordered={false}>
          <Statistic title="Pending" value={pendingCount} prefix={<ClockCircleOutlined style={{ color: '#f59e0b' }} />} />
        </Card>
        <Card className="metric-card metric-card--danger" bordered={false}>
          <Statistic title="Failed" value={failedCount} prefix={<CloseCircleOutlined style={{ color: '#ef4444' }} />} />
        </Card>
      </div>

      <Card className="section-card" bordered={false}>
        <div className="toolbar">
          <div className="toolbar-left">
            <Select
              style={{ width: 200 }}
              placeholder="选择集群"
              value={selectedCluster || undefined}
              onChange={setSelectedCluster}
            >
              {clusters.map((c) => (
                <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>
              ))}
            </Select>
            <Select
              style={{ width: 180 }}
              placeholder="全部命名空间"
              allowClear
              value={selectedNs || undefined}
              onChange={(v) => setSelectedNs(v || '')}
            >
              {namespaces.map((ns) => (
                <Select.Option key={ns.name} value={ns.name}>{ns.name}</Select.Option>
              ))}
            </Select>
            <Input
              placeholder="搜索 Pod"
              prefix={<SearchOutlined />}
              style={{ width: 220 }}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              allowClear
            />
          </div>
          <div className="toolbar-right" />
        </div>
        <Table
          columns={columns}
          dataSource={filtered}
          rowKey={(r) => `${r.namespace}/${r.name}`}
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }}
        />
      </Card>

      <Drawer
        title="Pod 详情"
        width={560}
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
      >
        {currentPod && (
          <Tabs
            activeKey={detailTab}
            onChange={(key) => {
              const next = key as 'detail' | 'yaml' | 'logs'
              setDetailTab(next)
              if (next === 'yaml') {
                loadDetailYaml()
              }
              if (next === 'logs' && currentPod) {
                fetchContainers(currentPod)
                fetchPodLogs(currentPod)
              }
            }}
            items={[
              {
                key: 'detail',
                label: '详情',
                children: (
                  <Descriptions bordered column={1}>
                    <Descriptions.Item label="名称">{currentPod.name}</Descriptions.Item>
                    <Descriptions.Item label="命名空间">{currentPod.namespace}</Descriptions.Item>
                    <Descriptions.Item label="状态">
                      <Tag color={currentPod.status === 'Running' ? 'green' : 'orange'}>{currentPod.status}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="就绪">{currentPod.ready}/{currentPod.replicas}</Descriptions.Item>
                    <Descriptions.Item label="镜像">
                      {currentPod.images?.map((img, i) => (
                        <Tag key={i} style={{ marginBottom: 4 }}>{img}</Tag>
                      ))}
                    </Descriptions.Item>
                    <Descriptions.Item label="创建时间">
                      {dayjs(currentPod.created_at).format('YYYY-MM-DD HH:mm:ss')}
                    </Descriptions.Item>
                  </Descriptions>
                ),
              },
              {
                key: 'yaml',
                label: 'YAML',
                children: (
                  <>
                    <Space style={{ marginBottom: 12 }}>
                      <Button type="primary" onClick={() => openYamlEditor(currentPod)}>编辑 YAML</Button>
                      <Button onClick={() => loadDetailYaml(true)}>刷新</Button>
                    </Space>
                    <Spin spinning={detailYamlLoading}>
                      <pre style={{ background: '#f8fafc', padding: 16, borderRadius: 8, overflow: 'auto', maxHeight: 420, fontSize: 12 }}>
                        {detailYaml || '暂无 YAML'}
                      </pre>
                    </Spin>
                  </>
                ),
              },
              {
                key: 'logs',
                label: '日志',
                children: (
                  <>
                    <Space style={{ marginBottom: 12 }}>
                      {containers.length > 1 && (
                        <Select
                          size="small"
                          style={{ width: 200 }}
                          value={logContainer || undefined}
                          onChange={(v) => setLogContainer(v)}
                          placeholder="选择容器"
                        >
                          {containers.map((c) => (
                            <Select.Option key={c} value={c}>{c}</Select.Option>
                          ))}
                        </Select>
                      )}
                      <Select
                        size="small"
                        style={{ width: 120 }}
                        value={logTailLines}
                        onChange={(v) => setLogTailLines(v)}
                      >
                        <Select.Option value={100}>100 行</Select.Option>
                        <Select.Option value={200}>200 行</Select.Option>
                        <Select.Option value={500}>500 行</Select.Option>
                        <Select.Option value={1000}>1000 行</Select.Option>
                      </Select>
                      <Button size="small" onClick={() => fetchPodLogs()}>刷新</Button>
                    </Space>
                    <Spin spinning={logLoading}>
                      <pre style={{
                        background: '#1a1a2e',
                        color: '#e0e0e0',
                        padding: 16,
                        borderRadius: 8,
                        overflow: 'auto',
                        maxHeight: 500,
                        fontSize: 12,
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                      }}>
                        {logText || '暂无日志'}
                      </pre>
                    </Spin>
                  </>
                ),
              },
            ]}
          />
        )}
      </Drawer>

      <Drawer
        title="编辑 Pod YAML"
        width={720}
        open={yamlVisible}
        onClose={() => setYamlVisible(false)}
        extra={(
          <Space>
            <Button onClick={formatYamlEdit} loading={yamlEditorLoading}>格式化</Button>
            <Button onClick={validateYamlEdit} loading={yamlEditorLoading}>校验</Button>
            <Button onClick={openHistory}>历史版本</Button>
            <Button onClick={() => setDiffVisible(true)} disabled={!yamlOriginal}>预览差异</Button>
            <Button onClick={() => setYamlEditorText(yamlOriginal)} disabled={!yamlOriginal}>重置</Button>
            <Button type="primary" loading={yamlEditorLoading} onClick={applyYamlEdit}>应用 YAML</Button>
          </Space>
        )}
      >
        <Spin spinning={yamlEditorLoading}>
          <Input.TextArea
            value={yamlEditorText}
            onChange={(e) => setYamlEditorText(e.target.value)}
            rows={20}
            placeholder="加载中..."
            style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}
          />
          <div style={{ marginTop: 8, color: '#64748b', fontSize: 12 }}>
            提示：Pod 通常由控制器管理，直接修改可能被回滚。
          </div>
        </Spin>
      </Drawer>

      <Drawer
        title="YAML 差异预览"
        width={760}
        open={diffVisible}
        onClose={() => setDiffVisible(false)}
      >
        <YamlDiffViewer original={yamlOriginal} modified={yamlEditorText} />
      </Drawer>

      <YamlHistoryModal
        open={historyVisible}
        loading={historyLoading}
        items={historyItems}
        current={yamlEditorText}
        onClose={() => setHistoryVisible(false)}
        onRestore={handleHistoryRestore}
        onRollback={handleHistoryRollback}
      />
    </div>
  )
}

export default PodList
