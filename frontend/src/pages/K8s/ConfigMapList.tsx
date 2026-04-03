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
  FileTextOutlined,
  DeleteOutlined,
  EditOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { k8sService, Cluster, K8sConfigMap, K8sNamespace, K8sYamlHistory } from '@/services/k8s'
import YamlDiffViewer from '@/components/YamlDiffViewer'
import YamlHistoryModal from '@/components/YamlHistoryModal'

const formatYamlValue = (value: string) => {
  if (value === '') return '""'
  return JSON.stringify(value)
}

const configMapYamlTemplate = (namespace?: string, variant: 'simple' | 'file' = 'simple') => {
  const ns = namespace || 'default'
  if (variant === 'file') {
    return `apiVersion: v1
kind: ConfigMap
metadata:
  name: demo-config
  namespace: ${ns}
data:
  app.conf: |
    server {
      listen 80;
      server_name example.com;
    }
`
  }
  return `apiVersion: v1
kind: ConfigMap
metadata:
  name: demo-config
  namespace: ${ns}
data:
  LOG_LEVEL: "info"
  FEATURE_FLAG: "true"
`
}

const configMapYamlFromRecord = (record: K8sConfigMap) => {
  const dataLines = Object.entries(record.data || {}).map(([key, value]) => `  ${key}: ${formatYamlValue(value)}`)
  return `apiVersion: v1
kind: ConfigMap
metadata:
  name: ${record.name}
  namespace: ${record.namespace}
data:
${dataLines.length > 0 ? dataLines.join('\n') : '  {}'}
`
}

const ConfigMapList: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [selectedCluster, setSelectedCluster] = useState<string>('')
  const [namespaces, setNamespaces] = useState<K8sNamespace[]>([])
  const [selectedNs, setSelectedNs] = useState<string>('')
  const [configMaps, setConfigMaps] = useState<K8sConfigMap[]>([])
  const [keyword, setKeyword] = useState('')
  const [detailVisible, setDetailVisible] = useState(false)
  const [currentConfigMap, setCurrentConfigMap] = useState<K8sConfigMap | null>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [editing, setEditing] = useState<K8sConfigMap | null>(null)
  const [saving, setSaving] = useState(false)
  const [createMode, setCreateMode] = useState<'form' | 'yaml'>('form')
  const [yamlText, setYamlText] = useState('')
  const [yamlNamespace, setYamlNamespace] = useState('')
  const [yamlLoading, setYamlLoading] = useState(false)
  const [yamlTemplate, setYamlTemplate] = useState<'simple' | 'file'>('simple')
  const [yamlActionLoading, setYamlActionLoading] = useState(false)
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

  const fetchConfigMaps = async () => {
    if (!selectedCluster) return
    setLoading(true)
    try {
      const res = await k8sService.getConfigMaps(selectedCluster, selectedNs)
      setConfigMaps(res.data || [])
    } catch {
      message.error('获取数据失败')
    }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchClusters() }, [])
  useEffect(() => { if (selectedCluster) { fetchNamespaces(); fetchConfigMaps() } }, [selectedCluster])
  useEffect(() => { if (selectedCluster) fetchConfigMaps() }, [selectedNs])

  const filtered = configMaps.filter((c) =>
    !keyword || c.name.toLowerCase().includes(keyword.toLowerCase())
  )

  const totalKeys = configMaps.reduce((sum, cm) => sum + Object.keys(cm.data || {}).length, 0)

  const openCreate = () => {
    const defaultNs = selectedNs || namespaces[0]?.name || 'default'
    setEditing(null)
    setCreateMode('form')
    setYamlTemplate('simple')
    setYamlNamespace(defaultNs)
    setYamlText(configMapYamlTemplate(defaultNs, 'simple'))
    setYamlOriginal('')
    setDiffVisible(false)
    form.resetFields()
    form.setFieldsValue({ entries: [{ key: '', value: '' }] })
    setModalVisible(true)
  }

  const openEdit = (record: K8sConfigMap) => {
    setEditing(record)
    setCreateMode('form')
    setYamlNamespace(record.namespace)
    const yaml = configMapYamlFromRecord(record)
    setYamlText(yaml)
    setYamlOriginal(yaml)
    setDiffVisible(false)
    form.setFieldsValue({
      name: record.name,
      namespace: record.namespace,
      entries: Object.entries(record.data || {}).map(([key, value]) => ({ key, value })),
    })
    setModalVisible(true)
  }

  const openYamlEditor = async (record: K8sConfigMap) => {
    if (!selectedCluster) {
      message.warning('请先选择集群')
      return
    }
    setEditing(record)
    setCreateMode('yaml')
    setYamlNamespace(record.namespace)
    setYamlText('')
    setModalVisible(true)
    setYamlLoading(true)
    try {
      const res = await k8sService.getYaml(selectedCluster, { kind: 'ConfigMap', name: record.name, namespace: record.namespace })
      setYamlText(res.data || '')
      setYamlOriginal(res.data || '')
      setDiffVisible(false)
    } catch {
      message.error('获取 YAML 失败')
    } finally {
      setYamlLoading(false)
    }
  }

  const loadDetailYaml = async (force = false) => {
    if (!currentConfigMap || !selectedCluster) return
    if (detailYaml && !force) return
    setDetailYamlLoading(true)
    try {
      const res = await k8sService.getYaml(selectedCluster, { kind: 'ConfigMap', name: currentConfigMap.name, namespace: currentConfigMap.namespace })
      setDetailYaml(res.data || '')
    } catch {
      message.error('获取 YAML 失败')
    } finally {
      setDetailYamlLoading(false)
    }
  }

  const openHistory = async () => {
    if (!selectedCluster || !editing) {
      message.warning('请先选择资源')
      return
    }
    setHistoryVisible(true)
    setHistoryLoading(true)
    try {
      const res = await k8sService.getYamlHistory(selectedCluster, {
        kind: 'ConfigMap',
        name: editing.name,
        namespace: editing.namespace,
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
    setYamlText(yaml)
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
        setModalVisible(false)
        fetchConfigMaps()
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

  const handleSave = async () => {
    try {
      if (createMode === 'yaml') {
        if (!yamlText.trim()) {
          message.error('请输入 YAML 内容')
          return
        }
        setSaving(true)
        await k8sService.applyYaml(selectedCluster, {
          yaml: yamlText,
          namespace: yamlNamespace || undefined,
        })
        message.success(editing ? '配置项更新成功' : '配置项创建成功')
        setModalVisible(false)
        fetchConfigMaps()
        return
      }

      const values = await form.validateFields()
      setSaving(true)
      const dataMap: Record<string, string> = {}
      for (const entry of values.entries || []) {
        if (entry.key) dataMap[entry.key] = entry.value || ''
      }

      if (editing) {
        await k8sService.updateConfigMap(selectedCluster, editing.namespace, editing.name, dataMap)
        message.success('配置项更新成功')
      } else {
        await k8sService.createConfigMap(selectedCluster, {
          name: values.name,
          namespace: values.namespace,
          data: dataMap,
        })
        message.success('配置项创建成功')
      }
      setModalVisible(false)
      fetchConfigMaps()
    } catch {
      message.error('操作失败')
    }
    finally { setSaving(false) }
  }

  const handleDelete = async (record: K8sConfigMap) => {
    try {
      await k8sService.deleteConfigMap(selectedCluster, record.namespace, record.name)
      message.success('删除成功')
      fetchConfigMaps()
    } catch {
      message.error('删除失败')
    }
  }

  const columns: ColumnsType<K8sConfigMap> = [
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
              setCurrentConfigMap(record)
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
      title: 'Keys',
      dataIndex: 'data',
      key: 'keys',
      render: (data: Record<string, string>) => {
        const keys = Object.keys(data || {})
        return keys.length > 0
          ? keys.map((k) => <Tag key={k}>{k}</Tag>)
          : <span style={{ color: '#999' }}>-</span>
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
      width: 140,
      render: (_, record) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>编辑</Button>
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
          <div className="page-hero-title">配置项</div>
          <p className="page-hero-subtitle">管理 Kubernetes ConfigMap 配置数据</p>
        </div>
        <div className="page-hero-actions">
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            创建配置项
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchConfigMaps}>刷新</Button>
        </div>
      </div>

      <div className="metric-grid">
        <Card className="metric-card metric-card--primary" bordered={false}>
          <Statistic title="ConfigMap 总数" value={configMaps.length} prefix={<FileTextOutlined style={{ color: '#0ea5e9' }} />} />
        </Card>
        <Card className="metric-card metric-card--success" bordered={false}>
          <Statistic title="Key 总数" value={totalKeys} prefix={<FileTextOutlined style={{ color: '#22c55e' }} />} />
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
              placeholder="搜索 ConfigMap"
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
          scroll={{ x: 1000 }}
          pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }}
        />
      </Card>

      <Modal
        title={editing ? '编辑配置项' : '创建配置项'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        width={640}
        footer={(
          <Space>
            <Button onClick={() => setModalVisible(false)}>取消</Button>
            <Button type="primary" loading={saving} onClick={handleSave}>
              {createMode === 'yaml' ? '应用 YAML' : '保存'}
            </Button>
          </Space>
        )}
      >
        <Segmented
          options={[
            { label: editing ? '表单编辑' : '表单创建', value: 'form' },
            { label: editing ? 'YAML 编辑' : 'YAML 创建', value: 'yaml' },
          ]}
          value={createMode}
          onChange={(value) => {
            const mode = value as 'form' | 'yaml'
            setCreateMode(mode)
            if (mode === 'yaml' && !yamlText.trim()) {
              const defaultNs = yamlNamespace || selectedNs || namespaces[0]?.name || 'default'
              setYamlTemplate('simple')
              setYamlNamespace(defaultNs)
              const nextYaml = editing ? configMapYamlFromRecord(editing) : configMapYamlTemplate(defaultNs, 'simple')
              setYamlText(nextYaml)
              setYamlOriginal(editing ? nextYaml : '')
            }
          }}
          style={{ marginBottom: 16 }}
        />
        {createMode === 'yaml' ? (
          <Spin spinning={yamlLoading}>
            <Form layout="vertical">
              <div className="yaml-toolbar">
                <Select
                  value={yamlTemplate}
                  onChange={(value) => {
                    const next = value as 'simple' | 'file'
                    const ns = yamlNamespace || selectedNs || namespaces[0]?.name || 'default'
                    setYamlTemplate(next)
                    setYamlText(configMapYamlTemplate(ns, next))
                  }}
                  disabled={!!editing}
                  options={[
                    { label: '简单键值', value: 'simple' },
                    { label: '文件片段', value: 'file' },
                  ]}
                />
                <Button onClick={handleFormatYaml} loading={yamlActionLoading}>格式化</Button>
                <Button onClick={handleValidateYaml} loading={yamlActionLoading}>校验</Button>
                <Button onClick={openHistory} disabled={!editing}>历史版本</Button>
                <Button onClick={() => setDiffVisible(true)} disabled={!yamlOriginal}>预览差异</Button>
                <Button onClick={() => setYamlText(yamlOriginal)} disabled={!yamlOriginal}>重置</Button>
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
                提示：YAML 模式会直接应用到集群，适合批量键值或复杂内容。
              </Typography.Text>
            </Form>
          </Spin>
        ) : (
          <Form form={form} layout="vertical">
            <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }, { pattern: /^[a-z0-9][a-z0-9.-]*$/, message: '小写字母、数字、点、中划线' }]}>
              <Input placeholder="例如: my-config" disabled={!!editing} />
            </Form.Item>
            {!editing && (
              <Form.Item name="namespace" label="命名空间" rules={[{ required: true, message: '请选择命名空间' }]}>
                <Select placeholder="选择命名空间">
                  {namespaces.map((ns) => (
                    <Select.Option key={ns.name} value={ns.name}>{ns.name}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            )}
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
                        <Input.TextArea placeholder="Value" style={{ width: 320 }} rows={1} />
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

      <Modal
        title="YAML 差异预览"
        open={diffVisible}
        onCancel={() => setDiffVisible(false)}
        width={760}
        footer={(
          <Button onClick={() => setDiffVisible(false)}>关闭</Button>
        )}
      >
        <YamlDiffViewer original={yamlOriginal} modified={yamlText} />
      </Modal>

      <YamlHistoryModal
        open={historyVisible}
        loading={historyLoading}
        items={historyItems}
        current={yamlText}
        onClose={() => setHistoryVisible(false)}
        onRestore={handleHistoryRestore}
        onRollback={handleHistoryRollback}
      />

      <Drawer
        title="ConfigMap 详情"
        width={600}
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
      >
        {currentConfigMap && (
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
                    <Descriptions.Item label="名称">{currentConfigMap.name}</Descriptions.Item>
                    <Descriptions.Item label="命名空间">{currentConfigMap.namespace}</Descriptions.Item>
                    <Descriptions.Item label="Keys">
                      {Object.keys(currentConfigMap.data || {}).length > 0
                        ? Object.keys(currentConfigMap.data || {}).map((k) => <Tag key={k}>{k}</Tag>)
                        : '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="创建时间">
                      {dayjs(currentConfigMap.created_at).format('YYYY-MM-DD HH:mm:ss')}
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
                      <Button type="primary" onClick={() => openYamlEditor(currentConfigMap)}>编辑 YAML</Button>
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
    </div>
  )
}

export default ConfigMapList
