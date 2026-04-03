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
  Modal,
  Form,
  Segmented,
  Spin,
  Drawer,
  Descriptions,
  Tabs,
  Typography,
  message,
  Popconfirm,
  Tooltip,
} from 'antd'
import {
  ReloadOutlined,
  PlusOutlined,
  SearchOutlined,
  LockOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  DeleteOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { k8sService, Cluster, K8sSecret, K8sNamespace, K8sYamlHistory } from '@/services/k8s'
import YamlDiffViewer from '@/components/YamlDiffViewer'
import YamlHistoryModal from '@/components/YamlHistoryModal'

const secretYamlTemplate = (namespace?: string, variant: 'opaque' | 'tls' | 'docker' = 'opaque') => {
  const ns = namespace || 'default'
  if (variant === 'tls') {
    return `apiVersion: v1
kind: Secret
metadata:
  name: demo-tls
  namespace: ${ns}
type: kubernetes.io/tls
stringData:
  tls.crt: "BASE64_CERT"
  tls.key: "BASE64_KEY"
`
  }
  if (variant === 'docker') {
    return `apiVersion: v1
kind: Secret
metadata:
  name: demo-docker
  namespace: ${ns}
type: kubernetes.io/dockerconfigjson
stringData:
  .dockerconfigjson: |
    {"auths":{"registry.example.com":{"username":"user","password":"pass","auth":"dXNlcjpwYXNz"}}}
`
  }
  return `apiVersion: v1
kind: Secret
metadata:
  name: demo-secret
  namespace: ${ns}
type: Opaque
stringData:
  username: "admin"
  password: "change-me"
`
}

const SecretList: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [selectedCluster, setSelectedCluster] = useState<string>('')
  const [namespaces, setNamespaces] = useState<K8sNamespace[]>([])
  const [selectedNs, setSelectedNs] = useState<string>('')
  const [secrets, setSecrets] = useState<K8sSecret[]>([])
  const [keyword, setKeyword] = useState('')
  const [detailVisible, setDetailVisible] = useState(false)
  const [currentSecret, setCurrentSecret] = useState<K8sSecret | null>(null)
  const [createVisible, setCreateVisible] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createMode, setCreateMode] = useState<'form' | 'yaml'>('form')
  const [yamlText, setYamlText] = useState('')
  const [yamlNamespace, setYamlNamespace] = useState('')
  const [yamlTemplate, setYamlTemplate] = useState<'opaque' | 'tls' | 'docker'>('opaque')
  const [yamlActionLoading, setYamlActionLoading] = useState(false)
  const [yamlVisible, setYamlVisible] = useState(false)
  const [yamlEditorLoading, setYamlEditorLoading] = useState(false)
  const [yamlEditorText, setYamlEditorText] = useState('')
  const [yamlTarget, setYamlTarget] = useState<{ name: string; namespace: string } | null>(null)
  const [yamlOriginal, setYamlOriginal] = useState('')
  const [diffVisible, setDiffVisible] = useState(false)
  const [historyVisible, setHistoryVisible] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyItems, setHistoryItems] = useState<K8sYamlHistory[]>([])
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set())
  const [form] = Form.useForm()

  const [detailTab, setDetailTab] = useState<'detail' | 'yaml'>('detail')
  const [detailYaml, setDetailYaml] = useState('')
  const [detailYamlLoading, setDetailYamlLoading] = useState(false)

  const fetchClusters = async () => {
    try {
      const res = await k8sService.listClusters({ page: 1, page_size: 100 })
      const list = res.data.list || []
      setClusters(list)
      if (list.length > 0) setSelectedCluster(list[0].id)
    } catch { message.error('获取数据失败') }
  }

  const fetchNamespaces = async () => {
    if (!selectedCluster) return
    try {
      const res = await k8sService.getNamespaces(selectedCluster)
      setNamespaces(res.data || [])
    } catch { message.error('获取数据失败') }
  }

  const fetchSecrets = async () => {
    if (!selectedCluster) return
    setLoading(true)
    try {
      const res = await k8sService.getSecrets(selectedCluster, selectedNs)
      setSecrets(res.data || [])
    } catch { message.error('获取数据失败') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchClusters() }, [])
  useEffect(() => { if (selectedCluster) { fetchNamespaces(); fetchSecrets() } }, [selectedCluster])
  useEffect(() => { if (selectedCluster) fetchSecrets() }, [selectedNs])

  const filtered = secrets.filter((s) =>
    !keyword || s.name.toLowerCase().includes(keyword.toLowerCase())
  )

  const typeCount = (t: string) => secrets.filter((s) => s.type === t).length

  const toggleReveal = (key: string) => {
    setRevealedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleCreate = async () => {
    try {
      if (createMode === 'yaml') {
        if (!yamlText.trim()) {
          message.error('请输入 YAML 内容')
          return
        }
        setCreating(true)
        await k8sService.applyYaml(selectedCluster, {
          yaml: yamlText,
          namespace: yamlNamespace || undefined,
        })
        message.success('YAML 已应用')
        setCreateVisible(false)
        form.resetFields()
        fetchSecrets()
        return
      }

      const values = await form.validateFields()
      setCreating(true)
      const dataMap: Record<string, string> = {}
      for (const entry of values.entries || []) {
        if (entry.key) dataMap[entry.key] = entry.value || ''
      }
      await k8sService.createSecret(selectedCluster, {
        name: values.name,
        namespace: values.namespace,
        type: values.type,
        data: dataMap,
      })
      message.success('保密字典创建成功')
      setCreateVisible(false)
      form.resetFields()
      fetchSecrets()
    } catch { message.error('操作失败') }
    finally { setCreating(false) }
  }

  const handleDelete = async (record: K8sSecret) => {
    try {
      await k8sService.deleteSecret(selectedCluster, record.namespace, record.name)
      message.success('删除成功')
      fetchSecrets()
    } catch { message.error('删除失败') }
  }

  const loadDetailYaml = async (force = false) => {
    if (!currentSecret || !selectedCluster) return
    if (detailYaml && !force) return
    setDetailYamlLoading(true)
    try {
      const res = await k8sService.getYaml(selectedCluster, { kind: 'Secret', name: currentSecret.name, namespace: currentSecret.namespace })
      setDetailYaml(res.data || '')
    } catch {
      message.error('获取 YAML 失败')
    } finally {
      setDetailYamlLoading(false)
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
        kind: 'Secret',
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
        fetchSecrets()
      },
    })
  }

  const handleFormatYaml = async () => {
    if (!selectedCluster) {
      message.warning('请先选择集群')
      return
    }
    if (!yamlText.trim()) {
      message.error('请输入 YAML 内容')
      return
    }
    setYamlActionLoading(true)
    try {
      const res = await k8sService.formatYaml(selectedCluster, { yaml: yamlText })
      setYamlText(res.data || '')
      message.success('已格式化')
    } catch { message.error('操作失败') }
    finally { setYamlActionLoading(false) }
  }

  const handleValidateYaml = async () => {
    if (!selectedCluster) {
      message.warning('请先选择集群')
      return
    }
    if (!yamlText.trim()) {
      message.error('请输入 YAML 内容')
      return
    }
    setYamlActionLoading(true)
    try {
      await k8sService.applyYaml(selectedCluster, { yaml: yamlText, namespace: yamlNamespace || undefined, dry_run: true })
      message.success('校验通过')
    } catch { message.error('操作失败') }
    finally { setYamlActionLoading(false) }
  }

  const openYamlEditor = async (record: K8sSecret) => {
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
      const res = await k8sService.getYaml(selectedCluster, { kind: 'Secret', name: record.name, namespace: record.namespace })
      setYamlEditorText(res.data || '')
      setYamlOriginal(res.data || '')
    } catch {
      message.error('获取 YAML 失败')
    } finally {
      setYamlEditorLoading(false)
    }
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
    } catch { message.error('操作失败') }
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
    } catch { message.error('操作失败') }
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
      fetchSecrets()
    } catch { message.error('操作失败') }
    finally { setYamlEditorLoading(false) }
  }

  const secretTypeColor: Record<string, string> = {
    Opaque: 'blue',
    'kubernetes.io/tls': 'green',
    'kubernetes.io/dockerconfigjson': 'purple',
    'kubernetes.io/service-account-token': 'orange',
  }

  const columns: ColumnsType<K8sSecret> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 260,
      ellipsis: true,
      render: (name: string, record) => (
        <Tooltip title={name}>
          <a
            onClick={() => {
              setCurrentSecret(record)
              setDetailTab('detail')
              setDetailYaml('')
              setDetailVisible(true)
            }}
            style={{ fontWeight: 600 }}
          >
            {name}
          </a>
        </Tooltip>
      ),
    },
    { title: '命名空间', dataIndex: 'namespace', key: 'namespace', width: 140 },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 200,
      render: (t: string) => <Tag color={secretTypeColor[t] || 'default'}>{t}</Tag>,
    },
    {
      title: '数据',
      dataIndex: 'data',
      key: 'data',
      render: (data: Record<string, string>, record) => {
        const entries = Object.entries(data || {})
        if (entries.length === 0) return <span style={{ color: '#999' }}>-</span>
        return (
          <Space direction="vertical" size={2}>
            {entries.map(([k, v]) => {
              const revealKey = `${record.namespace}/${record.name}/${k}`
              const isRevealed = revealedKeys.has(revealKey)
              return (
                <span key={k} style={{ fontSize: 12 }}>
                  <Tag>{k}</Tag>
                  <span style={{ color: '#666', fontFamily: 'monospace' }}>
                    {isRevealed ? v : '••••••••'}
                  </span>
                  <Button
                    type="link"
                    size="small"
                    icon={isRevealed ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                    onClick={() => toggleReveal(revealKey)}
                    style={{ padding: '0 4px' }}
                  />
                </span>
              )
            })}
          </Space>
        )
      },
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
        <Space size={4}>
          <Button type="link" size="small" onClick={() => openYamlEditor(record)}>YAML</Button>
          <Popconfirm title={`确认删除 ${record.name}？`} onConfirm={() => handleDelete(record)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="page-shell fade-in">
      <div className="page-hero">
        <div>
          <div className="page-hero-title">保密字典</div>
          <p className="page-hero-subtitle">管理 Kubernetes Secret 敏感数据</p>
        </div>
        <div className="page-hero-actions">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              const defaultNs = selectedNs || namespaces[0]?.name || 'default'
              setCreateMode('form')
              setYamlTemplate('opaque')
              setYamlNamespace(defaultNs)
              setYamlText(secretYamlTemplate(defaultNs, 'opaque'))
              form.resetFields()
              setCreateVisible(true)
            }}
          >
            创建保密字典
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchSecrets}>刷新</Button>
        </div>
      </div>

      <div className="metric-grid">
        <Card className="metric-card metric-card--primary" bordered={false}>
          <Statistic title="Secret 总数" value={secrets.length} prefix={<LockOutlined style={{ color: '#0ea5e9' }} />} />
        </Card>
        <Card className="metric-card metric-card--success" bordered={false}>
          <Statistic title="Opaque" value={typeCount('Opaque')} prefix={<LockOutlined style={{ color: '#22c55e' }} />} />
        </Card>
        <Card className="metric-card metric-card--warning" bordered={false}>
          <Statistic title="TLS / Docker" value={typeCount('kubernetes.io/tls') + typeCount('kubernetes.io/dockerconfigjson')} prefix={<LockOutlined style={{ color: '#f59e0b' }} />} />
        </Card>
      </div>

      <Card className="section-card" bordered={false}>
        <div className="toolbar">
          <div className="toolbar-left">
            <Select
              style={{ width: 200 }}
              placeholder="选择集群"
              value={selectedCluster || undefined}
              onChange={(v) => { setSelectedCluster(v); setSelectedNs('') }}
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
              placeholder="搜索 Secret"
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

      <Modal
        title="创建保密字典"
        open={createVisible}
        onCancel={() => setCreateVisible(false)}
        width={640}
        footer={(
          <Space>
            <Button onClick={() => setCreateVisible(false)}>取消</Button>
            <Button type="primary" loading={creating} onClick={handleCreate}>
              {createMode === 'yaml' ? '应用 YAML' : '确认创建'}
            </Button>
          </Space>
        )}
      >
        <Segmented
          options={[
            { label: '表单创建', value: 'form' },
            { label: 'YAML 创建', value: 'yaml' },
          ]}
          value={createMode}
          onChange={(value) => {
            const mode = value as 'form' | 'yaml'
            setCreateMode(mode)
            if (mode === 'yaml' && !yamlText.trim()) {
              const defaultNs = yamlNamespace || selectedNs || namespaces[0]?.name || 'default'
              setYamlTemplate('opaque')
              setYamlNamespace(defaultNs)
              setYamlText(secretYamlTemplate(defaultNs, 'opaque'))
            }
          }}
          style={{ marginBottom: 16 }}
        />
        {createMode === 'yaml' ? (
          <Form layout="vertical">
            <div className="yaml-toolbar">
              <Select
                value={yamlTemplate}
                onChange={(value) => {
                  const next = value as 'opaque' | 'tls' | 'docker'
                  const ns = yamlNamespace || selectedNs || namespaces[0]?.name || 'default'
                  setYamlTemplate(next)
                  setYamlText(secretYamlTemplate(ns, next))
                }}
                options={[
                  { label: 'Opaque', value: 'opaque' },
                  { label: 'TLS', value: 'tls' },
                  { label: 'Docker', value: 'docker' },
                ]}
              />
              <Button onClick={handleFormatYaml} loading={yamlActionLoading}>格式化</Button>
              <Button onClick={handleValidateYaml} loading={yamlActionLoading}>校验</Button>
            </div>
            <Form.Item label="默认命名空间" extra="当 YAML 未指定 namespace 时使用">
              <Select
                allowClear
                placeholder="从 YAML 读取"
                value={yamlNamespace || undefined}
                onChange={(v) => setYamlNamespace(v || '')}
              >
                {namespaces.map((ns) => (
                  <Select.Option key={ns.name} value={ns.name}>{ns.name}</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item label="YAML" extra="支持多文档 YAML（---）">
              <Input.TextArea
                value={yamlText}
                onChange={(e) => setYamlText(e.target.value)}
                rows={16}
                placeholder="粘贴或编写 Kubernetes YAML"
                style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}
              />
            </Form.Item>
            <Typography.Text type="secondary">
              提示：Secret 建议使用 stringData 便于明文编辑，系统会自动处理。
            </Typography.Text>
          </Form>
        ) : (
          <Form form={form} layout="vertical" initialValues={{ type: 'Opaque', entries: [{ key: '', value: '' }] }}>
            <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }, { pattern: /^[a-z0-9][a-z0-9.-]*$/, message: '小写字母、数字、点、中划线' }]}>
              <Input placeholder="例如: my-secret" />
            </Form.Item>
            <Form.Item name="namespace" label="命名空间" rules={[{ required: true, message: '请选择命名空间' }]}>
              <Select placeholder="选择命名空间">
                {namespaces.map((ns) => (
                  <Select.Option key={ns.name} value={ns.name}>{ns.name}</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="type" label="类型" rules={[{ required: true }]}>
              <Select>
                <Select.Option value="Opaque">Opaque</Select.Option>
                <Select.Option value="kubernetes.io/tls">TLS (kubernetes.io/tls)</Select.Option>
                <Select.Option value="kubernetes.io/dockerconfigjson">Docker (kubernetes.io/dockerconfigjson)</Select.Option>
              </Select>
            </Form.Item>
            <Form.List name="entries">
              {(fields, { add, remove }) => (
                <>
                  <div style={{ marginBottom: 8, fontWeight: 500 }}>数据 (Key-Value)</div>
                  {fields.map(({ key, name, ...restField }) => (
                    <Space key={key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                      <Form.Item {...restField} name={[name, 'key']} noStyle rules={[{ required: true, message: '请输入 Key' }]}>
                        <Input placeholder="Key" style={{ width: 180 }} />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'value']} noStyle>
                        <Input.Password placeholder="Value" style={{ width: 320 }} />
                      </Form.Item>
                      {fields.length > 1 && (
                        <MinusCircleOutlined onClick={() => remove(name)} style={{ color: '#ff4d4f' }} />
                      )}
                    </Space>
                  ))}
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                    添加数据项
                  </Button>
                </>
              )}
            </Form.List>
          </Form>
        )}
      </Modal>

      <Drawer
        title="Secret 详情"
        width={600}
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
      >
        {currentSecret && (
          <Tabs
            activeKey={detailTab}
            onChange={(key) => {
              const next = key as 'detail' | 'yaml'
              setDetailTab(next)
              if (next === 'yaml') {
                loadDetailYaml()
              }
            }}
            items={[
              {
                key: 'detail',
                label: '详情',
                children: (
                  <Descriptions bordered column={1}>
                    <Descriptions.Item label="名称">{currentSecret.name}</Descriptions.Item>
                    <Descriptions.Item label="命名空间">{currentSecret.namespace}</Descriptions.Item>
                    <Descriptions.Item label="类型">{currentSecret.type || 'Opaque'}</Descriptions.Item>
                    <Descriptions.Item label="数据">
                      <Space direction="vertical" size={2}>
                        {Object.entries(currentSecret.data || {}).map(([k, v]) => (
                          <span key={k} style={{ fontSize: 12 }}>
                            <Tag>{k}</Tag>
                            <span style={{ color: '#666', fontFamily: 'monospace' }}>{v ? '••••••••' : '-'}</span>
                          </span>
                        ))}
                      </Space>
                    </Descriptions.Item>
                    <Descriptions.Item label="创建时间">
                      {dayjs(currentSecret.created_at).format('YYYY-MM-DD HH:mm:ss')}
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
                      <Button type="primary" onClick={() => openYamlEditor(currentSecret)}>编辑 YAML</Button>
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
            ]}
          />
        )}
      </Drawer>

      <Modal
        title={`编辑 YAML - ${yamlTarget?.name || ''}`}
        open={yamlVisible}
        onCancel={() => setYamlVisible(false)}
        width={720}
        footer={(
          <Space>
            <Button onClick={() => setYamlVisible(false)}>关闭</Button>
            <Button type="primary" loading={yamlEditorLoading} onClick={applyYamlEdit}>应用 YAML</Button>
          </Space>
        )}
      >
        <Spin spinning={yamlEditorLoading}>
          <div className="yaml-toolbar">
            <Button onClick={formatYamlEdit} loading={yamlEditorLoading}>格式化</Button>
            <Button onClick={validateYamlEdit} loading={yamlEditorLoading}>校验</Button>
            <Button onClick={openHistory}>历史版本</Button>
            <Button onClick={() => setDiffVisible(true)} disabled={!yamlOriginal}>预览差异</Button>
            <Button onClick={() => setYamlEditorText(yamlOriginal)} disabled={!yamlOriginal}>重置</Button>
          </div>
          <Input.TextArea
            value={yamlEditorText}
            onChange={(e) => setYamlEditorText(e.target.value)}
            rows={18}
            placeholder="加载中..."
            style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}
          />
          <Typography.Text type="secondary">
            提示：如果包含敏感信息，建议使用 stringData。
          </Typography.Text>
        </Spin>
      </Modal>

      <Modal
        title="YAML 差异预览"
        open={diffVisible}
        onCancel={() => setDiffVisible(false)}
        width={760}
        footer={(
          <Button onClick={() => setDiffVisible(false)}>关闭</Button>
        )}
      >
        <YamlDiffViewer original={yamlOriginal} modified={yamlEditorText} />
      </Modal>

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

export default SecretList
