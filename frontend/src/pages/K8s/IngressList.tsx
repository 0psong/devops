import React, { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Tag,
  Select,
  Space,
  Button,
  Row,
  Col,
  Statistic,
  Input,
  Drawer,
  Descriptions,
  Modal,
  Form,
  Segmented,
  Spin,
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
  GatewayOutlined,
  GlobalOutlined,
  DeleteOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { k8sService, Cluster, K8sIngress, K8sNamespace, K8sYamlHistory } from '@/services/k8s'
import YamlDiffViewer from '@/components/YamlDiffViewer'
import YamlHistoryModal from '@/components/YamlHistoryModal'

const ingressYamlTemplate = (namespace?: string, variant: 'http' | 'tls' = 'http') => {
  const ns = namespace || 'default'
  if (variant === 'tls') {
    return `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: demo-ingress
  namespace: ${ns}
spec:
  tls:
  - hosts:
    - example.com
    secretName: demo-tls
  rules:
  - host: example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: demo-service
            port:
              number: 80
`
  }
  return `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: demo-ingress
  namespace: ${ns}
spec:
  rules:
  - host: example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: demo-service
            port:
              number: 80
`
}

const IngressList: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [selectedCluster, setSelectedCluster] = useState<string>('')
  const [namespaces, setNamespaces] = useState<K8sNamespace[]>([])
  const [selectedNs, setSelectedNs] = useState<string>('')
  const [ingresses, setIngresses] = useState<K8sIngress[]>([])
  const [keyword, setKeyword] = useState('')
  const [detailVisible, setDetailVisible] = useState(false)
  const [currentIngress, setCurrentIngress] = useState<K8sIngress | null>(null)
  const [createVisible, setCreateVisible] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createMode, setCreateMode] = useState<'form' | 'yaml'>('form')
  const [yamlText, setYamlText] = useState('')
  const [yamlNamespace, setYamlNamespace] = useState('')
  const [yamlTemplate, setYamlTemplate] = useState<'http' | 'tls'>('http')
  const [yamlActionLoading, setYamlActionLoading] = useState(false)
  const [yamlVisible, setYamlVisible] = useState(false)
  const [yamlLoading, setYamlLoading] = useState(false)
  const [yamlEditorText, setYamlEditorText] = useState('')
  const [yamlTarget, setYamlTarget] = useState<{ name: string; namespace: string } | null>(null)
  const [yamlOriginal, setYamlOriginal] = useState('')
  const [diffVisible, setDiffVisible] = useState(false)
  const [historyVisible, setHistoryVisible] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyItems, setHistoryItems] = useState<K8sYamlHistory[]>([])
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

  const fetchIngresses = async () => {
    if (!selectedCluster) return
    setLoading(true)
    try {
      const res = await k8sService.getIngresses(selectedCluster, selectedNs)
      setIngresses(res.data || [])
    } catch {
      message.error('获取数据失败')
    }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchClusters() }, [])
  useEffect(() => { if (selectedCluster) { fetchNamespaces(); fetchIngresses() } }, [selectedCluster])
  useEffect(() => { if (selectedCluster) fetchIngresses() }, [selectedNs])

  const filtered = ingresses.filter((i) =>
    !keyword || i.name.toLowerCase().includes(keyword.toLowerCase())
  )

  const hostCount = new Set(ingresses.flatMap((i) => i.hosts || [])).size

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
        fetchIngresses()
        return
      }

      const values = await form.validateFields()
      setCreating(true)
      await k8sService.createIngress(selectedCluster, {
        name: values.name,
        namespace: values.namespace,
        rules: values.rules.map((r: { host: string; path: string; backend: string; port: number }) => ({
          host: r.host,
          paths: [{ path: r.path || '/', backend: r.backend, port: r.port }],
        })),
      })
      message.success('路由创建成功')
      setCreateVisible(false)
      form.resetFields()
      fetchIngresses()
    } catch {
      message.error('操作失败')
    }
    finally { setCreating(false) }
  }

  const handleDelete = async (record: K8sIngress) => {
    try {
      await k8sService.deleteIngress(selectedCluster, record.namespace, record.name)
      message.success('删除成功')
      fetchIngresses()
    } catch {
      message.error('删除失败')
    }
  }

  const loadDetailYaml = async (force = false) => {
    if (!currentIngress || !selectedCluster) return
    if (detailYaml && !force) return
    setDetailYamlLoading(true)
    try {
      const res = await k8sService.getYaml(selectedCluster, { kind: 'Ingress', name: currentIngress.name, namespace: currentIngress.namespace })
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
        kind: 'Ingress',
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
        fetchIngresses()
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
    } catch {
      message.error('操作失败')
    }
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
    } catch {
      message.error('操作失败')
    }
    finally { setYamlActionLoading(false) }
  }

  const openYamlEditor = async (record: K8sIngress) => {
    if (!selectedCluster) {
      message.warning('请先选择集群')
      return
    }
    setYamlVisible(true)
    setYamlTarget({ name: record.name, namespace: record.namespace })
    setYamlEditorText('')
    setYamlOriginal('')
    setDiffVisible(false)
    setYamlLoading(true)
    try {
      const res = await k8sService.getYaml(selectedCluster, { kind: 'Ingress', name: record.name, namespace: record.namespace })
      setYamlEditorText(res.data || '')
      setYamlOriginal(res.data || '')
    } catch {
      message.error('获取 YAML 失败')
    } finally {
      setYamlLoading(false)
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
    setYamlLoading(true)
    try {
      const res = await k8sService.formatYaml(selectedCluster, { yaml: yamlEditorText })
      setYamlEditorText(res.data || '')
      message.success('已格式化')
    } catch {
      message.error('操作失败')
    }
    finally { setYamlLoading(false) }
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
    setYamlLoading(true)
    try {
      await k8sService.applyYaml(selectedCluster, { yaml: yamlEditorText, dry_run: true })
      message.success('校验通过')
    } catch {
      message.error('操作失败')
    }
    finally { setYamlLoading(false) }
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
    setYamlLoading(true)
    try {
      await k8sService.applyYaml(selectedCluster, { yaml: yamlEditorText })
      message.success('YAML 已应用')
      setYamlVisible(false)
      fetchIngresses()
    } catch {
      message.error('操作失败')
    }
    finally { setYamlLoading(false) }
  }

  const columns: ColumnsType<K8sIngress> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 220,
      ellipsis: true,
      render: (name: string, record) => (
        <Tooltip title={name}>
          <a
            onClick={() => {
              setCurrentIngress(record)
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
      title: 'Hosts',
      dataIndex: 'hosts',
      key: 'hosts',
      render: (hosts: string[]) => hosts?.map((h, i) => <Tag key={i} color="blue">{h}</Tag>) || '-',
    },
    {
      title: '规则',
      dataIndex: 'rules',
      key: 'rules',
      render: (rules: K8sIngress['rules']) => (
        <Space direction="vertical" size={2}>
          {rules?.map((rule, i) =>
            rule.paths?.map((p, j) => (
              <span key={`${i}-${j}`} style={{ fontSize: 12 }}>
                <Tag>{rule.host}{p.path}</Tag> → {p.backend}:{p.port}
              </span>
            ))
          ) || '-'}
        </Space>
      ),
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
          <div className="page-hero-title">路由</div>
          <p className="page-hero-subtitle">管理 Kubernetes Ingress 路由规则</p>
        </div>
        <div className="page-hero-actions">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              const defaultNs = selectedNs || namespaces[0]?.name || 'default'
              setCreateMode('form')
              setYamlTemplate('http')
              setYamlNamespace(defaultNs)
              setYamlText(ingressYamlTemplate(defaultNs, 'http'))
              setCreateVisible(true)
            }}
          >
            创建路由
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchIngresses}>刷新</Button>
        </div>
      </div>

      <div className="metric-grid">
        <Card className="metric-card metric-card--primary" bordered={false}>
          <Statistic title="Ingress 总数" value={ingresses.length} prefix={<GatewayOutlined style={{ color: '#0ea5e9' }} />} />
        </Card>
        <Card className="metric-card metric-card--success" bordered={false}>
          <Statistic title="域名数" value={hostCount} prefix={<GlobalOutlined style={{ color: '#22c55e' }} />} />
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
              placeholder="搜索 Ingress"
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
        title="创建路由"
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
              setYamlTemplate('http')
              setYamlNamespace(defaultNs)
              setYamlText(ingressYamlTemplate(defaultNs, 'http'))
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
                  const next = value as 'http' | 'tls'
                  const ns = yamlNamespace || selectedNs || namespaces[0]?.name || 'default'
                  setYamlTemplate(next)
                  setYamlText(ingressYamlTemplate(ns, next))
                }}
                options={[
                  { label: 'HTTP', value: 'http' },
                  { label: 'TLS', value: 'tls' },
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
              提示：Ingress 需要确保 Service 已存在并有对应端口。
            </Typography.Text>
          </Form>
        ) : (
          <Form form={form} layout="vertical">
            <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }, { pattern: /^[a-z0-9][a-z0-9-]*$/, message: '小写字母、数字、中划线' }]}>
              <Input placeholder="例如: my-ingress" />
            </Form.Item>
            <Form.Item name="namespace" label="命名空间" rules={[{ required: true, message: '请选择命名空间' }]}>
              <Select placeholder="选择命名空间">
                {namespaces.map((ns) => (
                  <Select.Option key={ns.name} value={ns.name}>{ns.name}</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.List name="rules" initialValue={[{}]}>
              {(fields, { add, remove }) => (
                <>
                  <div style={{ marginBottom: 8, fontWeight: 500 }}>路由规则</div>
                  {fields.map(({ key, name, ...restField }) => (
                    <Card key={key} size="small" style={{ marginBottom: 8 }}>
                      <Row gutter={8}>
                        <Col span={11}>
                          <Form.Item {...restField} name={[name, 'host']} label="域名" rules={[{ required: true, message: '请输入域名' }]}>
                            <Input placeholder="例如: example.com" />
                          </Form.Item>
                        </Col>
                        <Col span={11}>
                          <Form.Item {...restField} name={[name, 'path']} label="路径" initialValue="/">
                            <Input placeholder="/" />
                          </Form.Item>
                        </Col>
                        <Col span={2} style={{ display: 'flex', alignItems: 'center', paddingTop: 30 }}>
                          {fields.length > 1 && <MinusCircleOutlined onClick={() => remove(name)} style={{ color: '#ff4d4f' }} />}
                        </Col>
                        <Col span={12}>
                          <Form.Item {...restField} name={[name, 'backend']} label="后端服务" rules={[{ required: true, message: '请输入服务名' }]}>
                            <Input placeholder="服务名称" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item {...restField} name={[name, 'port']} label="端口" rules={[{ required: true, message: '请输入端口' }]}>
                            <Input type="number" placeholder="80" />
                          </Form.Item>
                        </Col>
                      </Row>
                    </Card>
                  ))}
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                    添加规则
                  </Button>
                </>
              )}
            </Form.List>
          </Form>
        )}
      </Modal>

      <Drawer
        title="Ingress 详情"
        width={600}
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
      >
        {currentIngress && (
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
                    <Descriptions.Item label="名称">{currentIngress.name}</Descriptions.Item>
                    <Descriptions.Item label="命名空间">{currentIngress.namespace}</Descriptions.Item>
                    <Descriptions.Item label="Hosts">
                      {currentIngress.hosts?.map((h, i) => <Tag key={i}>{h}</Tag>) || '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="规则">
                      <Space direction="vertical" size={4}>
                        {currentIngress.rules?.map((rule, i) =>
                          rule.paths?.map((p, j) => (
                            <span key={`${i}-${j}`} style={{ fontSize: 12 }}>
                              <Tag>{rule.host}{p.path}</Tag> → {p.backend}:{p.port}
                            </span>
                          ))
                        ) || '-'}
                      </Space>
                    </Descriptions.Item>
                    <Descriptions.Item label="创建时间">
                      {dayjs(currentIngress.created_at).format('YYYY-MM-DD HH:mm:ss')}
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
                      <Button type="primary" onClick={() => openYamlEditor(currentIngress)}>编辑 YAML</Button>
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
            <Button type="primary" loading={yamlLoading} onClick={applyYamlEdit}>应用 YAML</Button>
          </Space>
        )}
      >
        <Spin spinning={yamlLoading}>
          <div className="yaml-toolbar">
            <Button onClick={formatYamlEdit} loading={yamlLoading}>格式化</Button>
            <Button onClick={validateYamlEdit} loading={yamlLoading}>校验</Button>
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
            提示：修改 Ingress 规则后可直接应用生效。
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

export default IngressList
