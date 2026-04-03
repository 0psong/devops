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
  Modal,
  Form,
  InputNumber,
  Segmented,
  Spin,
  Tabs,
  Typography,
  message,
  Popconfirm,
} from 'antd'
import {
  ReloadOutlined,
  ApiOutlined,
  SearchOutlined,
  GlobalOutlined,
  NodeIndexOutlined,
  PlusOutlined,
  DeleteOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { k8sService, Cluster, K8sResource, K8sNamespace, K8sYamlHistory } from '@/services/k8s'
import YamlDiffViewer from '@/components/YamlDiffViewer'
import YamlHistoryModal from '@/components/YamlHistoryModal'

interface K8sServiceItem extends K8sResource {
  type?: string
  cluster_ip?: string
  external_ip?: string
  ports?: string
}

const serviceYamlTemplate = (namespace?: string, variant: 'clusterip' | 'nodeport' | 'loadbalancer' = 'clusterip') => {
  const ns = namespace || 'default'
  const type = variant === 'nodeport' ? 'NodePort' : variant === 'loadbalancer' ? 'LoadBalancer' : 'ClusterIP'
  const nodePortLine = variant === 'nodeport' ? '    nodePort: 30080\n' : ''
  return `apiVersion: v1
kind: Service
metadata:
  name: demo-service
  namespace: ${ns}
spec:
  type: ${type}
  selector:
    app: demo-app
  ports:
  - port: 80
    targetPort: 80
    protocol: TCP
${nodePortLine}`
}

const ServiceList: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [selectedCluster, setSelectedCluster] = useState<string>('')
  const [namespaces, setNamespaces] = useState<K8sNamespace[]>([])
  const [selectedNs, setSelectedNs] = useState<string>('')
  const [services, setServices] = useState<K8sServiceItem[]>([])
  const [keyword, setKeyword] = useState('')
  const [detailVisible, setDetailVisible] = useState(false)
  const [currentSvc, setCurrentSvc] = useState<K8sServiceItem | null>(null)
  const [createVisible, setCreateVisible] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createMode, setCreateMode] = useState<'form' | 'yaml'>('form')
  const [yamlText, setYamlText] = useState('')
  const [yamlNamespace, setYamlNamespace] = useState('')
  const [yamlTemplate, setYamlTemplate] = useState<'clusterip' | 'nodeport' | 'loadbalancer'>('clusterip')
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

  const fetchServices = async () => {
    if (!selectedCluster) return
    setLoading(true)
    try {
      const res = await k8sService.getServices(selectedCluster, selectedNs)
      setServices(res.data || [])
    } catch {
      message.error('获取数据失败')
    }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchClusters() }, [])
  useEffect(() => { if (selectedCluster) { fetchNamespaces(); fetchServices() } }, [selectedCluster])
  useEffect(() => { if (selectedCluster) fetchServices() }, [selectedNs])

  const filtered = services.filter((s) =>
    !keyword || s.name.toLowerCase().includes(keyword.toLowerCase())
  )

  const typeCount = (t: string) => services.filter((s) => s.status === t).length

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
        fetchServices()
        return
      }

      const values = await form.validateFields()
      setCreating(true)
      await k8sService.createService(selectedCluster, {
        name: values.name,
        namespace: values.namespace,
        type: values.type,
        ports: values.ports.filter((p: { port: number }) => p.port).map(
          (p: { port: number; targetPort: number; protocol?: string; nodePort?: number }) => ({
            port: p.port,
            targetPort: p.targetPort || p.port,
            protocol: p.protocol || 'TCP',
            nodePort: p.nodePort,
          })
        ),
        selector: values.selector
          ? Object.fromEntries(
              (values.selector as string).split(',').map((s: string) => s.trim().split('='))
            )
          : {},
      })
      message.success('Service 创建成功')
      setCreateVisible(false)
      form.resetFields()
      fetchServices()
    } catch {
      message.error('操作失败')
    }
    finally { setCreating(false) }
  }

  const handleDelete = async (record: K8sServiceItem) => {
    try {
      await k8sService.deleteService(selectedCluster, record.namespace, record.name)
      message.success('删除成功')
      fetchServices()
    } catch {
      message.error('删除失败')
    }
  }

  const loadDetailYaml = async (force = false) => {
    if (!currentSvc || !selectedCluster) return
    if (detailYaml && !force) return
    setDetailYamlLoading(true)
    try {
      const res = await k8sService.getYaml(selectedCluster, { kind: 'Service', name: currentSvc.name, namespace: currentSvc.namespace })
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
        kind: 'Service',
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
        fetchServices()
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

  const openYamlEditor = async (record: K8sServiceItem) => {
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
      const res = await k8sService.getYaml(selectedCluster, { kind: 'Service', name: record.name, namespace: record.namespace })
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
      fetchServices()
    } catch {
      message.error('操作失败')
    }
    finally { setYamlLoading(false) }
  }

  const columns: ColumnsType<K8sServiceItem> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 240,
      render: (name: string, record) => (
        <a onClick={() => { setCurrentSvc(record); setDetailTab('detail'); setDetailYaml(''); setDetailVisible(true) }}>
          {name}
        </a>
      ),
    },
    { title: '命名空间', dataIndex: 'namespace', key: 'namespace', width: 140 },
    {
      title: '类型',
      dataIndex: 'status',
      key: 'type',
      width: 120,
      render: (s: string) => {
        const colorMap: Record<string, string> = { ClusterIP: 'blue', NodePort: 'green', LoadBalancer: 'purple', ExternalName: 'orange' }
        return <Tag color={colorMap[s] || 'default'}>{s}</Tag>
      },
    },
    {
      title: '镜像 / 端口',
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
          <div className="page-hero-title">服务</div>
          <p className="page-hero-subtitle">跨集群查看和管理 Kubernetes Service 资源</p>
        </div>
        <div className="page-hero-actions">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              const defaultNs = selectedNs || namespaces[0]?.name || 'default'
              setCreateMode('form')
              setYamlTemplate('clusterip')
              setYamlNamespace(defaultNs)
              setYamlText(serviceYamlTemplate(defaultNs, 'clusterip'))
              form.resetFields()
              setCreateVisible(true)
            }}
          >
            创建服务
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchServices}>刷新</Button>
        </div>
      </div>

      <div className="metric-grid">
        <Card className="metric-card metric-card--primary" bordered={false}>
          <Statistic title="Service 总数" value={services.length} prefix={<ApiOutlined style={{ color: '#0ea5e9' }} />} />
        </Card>
        <Card className="metric-card metric-card--success" bordered={false}>
          <Statistic title="ClusterIP" value={typeCount('ClusterIP')} prefix={<NodeIndexOutlined style={{ color: '#22c55e' }} />} />
        </Card>
        <Card className="metric-card metric-card--warning" bordered={false}>
          <Statistic title="NodePort / LB" value={typeCount('NodePort') + typeCount('LoadBalancer')} prefix={<GlobalOutlined style={{ color: '#f59e0b' }} />} />
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
              placeholder="搜索 Service"
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
        title="Service 详情"
        width={560}
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
      >
        {currentSvc && (
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
                    <Descriptions.Item label="名称">{currentSvc.name}</Descriptions.Item>
                    <Descriptions.Item label="命名空间">{currentSvc.namespace}</Descriptions.Item>
                    <Descriptions.Item label="类型">
                      <Tag>{currentSvc.status}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="端口 / 选择器">
                      {currentSvc.images?.join(', ') || '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="创建时间">
                      {dayjs(currentSvc.created_at).format('YYYY-MM-DD HH:mm:ss')}
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
                      <Button type="primary" onClick={() => openYamlEditor(currentSvc)}>编辑 YAML</Button>
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
        title="创建服务"
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
              setYamlTemplate('clusterip')
              setYamlNamespace(defaultNs)
              setYamlText(serviceYamlTemplate(defaultNs, 'clusterip'))
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
                  const next = value as 'clusterip' | 'nodeport' | 'loadbalancer'
                  const ns = yamlNamespace || selectedNs || namespaces[0]?.name || 'default'
                  setYamlTemplate(next)
                  setYamlText(serviceYamlTemplate(ns, next))
                }}
                options={[
                  { label: 'ClusterIP', value: 'clusterip' },
                  { label: 'NodePort', value: 'nodeport' },
                  { label: 'LoadBalancer', value: 'loadbalancer' },
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
              提示：支持 Service 以及其他资源的 YAML 应用。
            </Typography.Text>
          </Form>
        ) : (
          <Form form={form} layout="vertical" initialValues={{ type: 'ClusterIP', ports: [{}] }}>
            <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }, { pattern: /^[a-z0-9][a-z0-9-]*$/, message: '小写字母、数字、中划线' }]}>
              <Input placeholder="例如: my-service" />
            </Form.Item>
            <Form.Item name="namespace" label="命名空间" rules={[{ required: true, message: '请选择命名空间' }]}>
              <Select placeholder="选择命名空间">
                {namespaces.map((ns) => (
                  <Select.Option key={ns.name} value={ns.name}>{ns.name}</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="type" label="类型">
              <Select>
                <Select.Option value="ClusterIP">ClusterIP</Select.Option>
                <Select.Option value="NodePort">NodePort</Select.Option>
                <Select.Option value="LoadBalancer">LoadBalancer</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="selector" label="选择器" extra="格式: key1=value1,key2=value2">
              <Input placeholder="app=myapp" />
            </Form.Item>
            <Form.List name="ports">
              {(fields, { add, remove }) => (
                <>
                  <div style={{ marginBottom: 8, fontWeight: 500 }}>端口映射</div>
                  {fields.map(({ key, name, ...restField }) => (
                    <Space key={key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                      <Form.Item {...restField} name={[name, 'port']} noStyle rules={[{ required: true, message: '端口' }]}>
                        <InputNumber placeholder="端口" min={1} max={65535} style={{ width: 100 }} />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'targetPort']} noStyle>
                        <InputNumber placeholder="目标端口" min={1} max={65535} style={{ width: 100 }} />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'protocol']} noStyle initialValue="TCP">
                        <Select style={{ width: 80 }}>
                          <Select.Option value="TCP">TCP</Select.Option>
                          <Select.Option value="UDP">UDP</Select.Option>
                        </Select>
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'nodePort']} noStyle>
                        <InputNumber placeholder="NodePort" min={30000} max={32767} style={{ width: 110 }} />
                      </Form.Item>
                      {fields.length > 1 && (
                        <MinusCircleOutlined onClick={() => remove(name)} style={{ color: '#ff4d4f' }} />
                      )}
                    </Space>
                  ))}
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                    添加端口
                  </Button>
                </>
              )}
            </Form.List>
          </Form>
        )}
      </Modal>

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
            提示：可以直接编辑 Service 的 ports 与 selector。
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

export default ServiceList
