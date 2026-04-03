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
  InputNumber,
  Segmented,
  Spin,
  Tabs,
  Steps,
  Typography,
  message,
  Popconfirm,
  Tooltip,
} from 'antd'
import {
  ReloadOutlined,
  PlusOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  ArrowsAltOutlined,
  RedoOutlined,
  MinusCircleOutlined,
  AppstoreOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { k8sService, Cluster, K8sResource, K8sNamespace, K8sYamlHistory } from '@/services/k8s'
import YamlDiffViewer from '@/components/YamlDiffViewer'
import YamlHistoryModal from '@/components/YamlHistoryModal'

interface WorkloadListProps {
  kind: 'Deployment' | 'StatefulSet' | 'DaemonSet' | 'CronJob'
}

const kindConfig: Record<string, { title: string; desc: string; endpoint: string }> = {
  Deployment: { title: '无状态', desc: '管理无状态应用 Deployment 资源', endpoint: 'deployments' },
  StatefulSet: { title: '有状态', desc: '管理有状态应用 StatefulSet 资源', endpoint: 'statefulsets' },
  DaemonSet: { title: '守护进程集', desc: '管理守护进程集 DaemonSet 资源', endpoint: 'daemonsets' },
  CronJob: { title: '任务', desc: '管理定时任务 CronJob 资源', endpoint: 'cronjobs' },
}

const workloadYamlTemplate = (
  kind: WorkloadListProps['kind'],
  namespace?: string,
  variant: 'basic' | 'probes' | 'resources' = 'basic',
) => {
  const ns = namespace || 'default'
  const probeBlock = `        livenessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 10
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 5
          periodSeconds: 5
`
  const resourceBlock = `        resources:
          requests:
            cpu: "100m"
            memory: "128Mi"
          limits:
            cpu: "500m"
            memory: "512Mi"
`
  const resourceBlockCron = `            resources:
              requests:
                cpu: "100m"
                memory: "128Mi"
              limits:
                cpu: "500m"
                memory: "512Mi"
`
  const extra = variant === 'probes' ? probeBlock : variant === 'resources' ? resourceBlock : ''

  switch (kind) {
    case 'StatefulSet':
      return `apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: demo-stateful
  namespace: ${ns}
spec:
  serviceName: demo-stateful
  replicas: 2
  selector:
    matchLabels:
      app: demo-stateful
  template:
    metadata:
      labels:
        app: demo-stateful
    spec:
      containers:
      - name: app
        image: nginx:1.25
        ports:
        - containerPort: 80
${extra}`
    case 'DaemonSet':
      return `apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: demo-daemon
  namespace: ${ns}
spec:
  selector:
    matchLabels:
      app: demo-daemon
  template:
    metadata:
      labels:
        app: demo-daemon
    spec:
      containers:
      - name: agent
        image: nginx:1.25
        ports:
        - containerPort: 80
${extra}`
    case 'CronJob':
      return `apiVersion: batch/v1
kind: CronJob
metadata:
  name: demo-cron
  namespace: ${ns}
spec:
  schedule: "*/5 * * * *"
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
          - name: job
            image: busybox:1.36
            args:
            - /bin/sh
            - -c
            - date; echo Hello from CronJob
${variant === 'resources' ? resourceBlockCron : ''}`
    default:
      return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: demo-app
  namespace: ${ns}
spec:
  replicas: 2
  selector:
    matchLabels:
      app: demo-app
  template:
    metadata:
      labels:
        app: demo-app
    spec:
      containers:
      - name: app
        image: nginx:1.25
        ports:
        - containerPort: 80
${extra}`
  }
}

const WorkloadList: React.FC<WorkloadListProps> = ({ kind }) => {
  const config = kindConfig[kind]

  const [loading, setLoading] = useState(false)
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [selectedCluster, setSelectedCluster] = useState<string>('')
  const [namespaces, setNamespaces] = useState<K8sNamespace[]>([])
  const [selectedNs, setSelectedNs] = useState<string>('')
  const [resources, setResources] = useState<K8sResource[]>([])
  const [keyword, setKeyword] = useState('')
  const [detailVisible, setDetailVisible] = useState(false)
  const [currentResource, setCurrentResource] = useState<K8sResource | null>(null)

  // Create modal
  const [createVisible, setCreateVisible] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [creating, setCreating] = useState(false)
  const [createMode, setCreateMode] = useState<'form' | 'yaml'>('form')
  const [yamlText, setYamlText] = useState('')
  const [yamlNamespace, setYamlNamespace] = useState('')
  const [yamlTemplate, setYamlTemplate] = useState<'basic' | 'probes' | 'resources'>('basic')
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
  const [basicForm] = Form.useForm()
  const [containerForm] = Form.useForm()

  const [detailTab, setDetailTab] = useState<'detail' | 'yaml'>('detail')
  const [detailYaml, setDetailYaml] = useState('')
  const [detailYamlLoading, setDetailYamlLoading] = useState(false)

  // Scale modal
  const [scaleVisible, setScaleVisible] = useState(false)
  const [scaleTarget, setScaleTarget] = useState<K8sResource | null>(null)
  const [scaleReplicas, setScaleReplicas] = useState(1)

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

  const fetchResources = async () => {
    if (!selectedCluster) return
    setLoading(true)
    try {
      const res = await k8sService.getWorkloads(selectedCluster, kind, selectedNs)
      setResources(res.data || [])
    } catch { message.error('获取数据失败') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchClusters() }, [])
  useEffect(() => {
    if (selectedCluster) {
      fetchNamespaces()
      fetchResources()
    }
  }, [selectedCluster, kind])
  useEffect(() => {
    if (selectedCluster) fetchResources()
  }, [selectedNs])

  const filtered = resources.filter((r) =>
    !keyword || r.name.toLowerCase().includes(keyword.toLowerCase())
  )

  const runningCount = resources.filter((r) => r.status === 'Running' || r.status === 'Active' || r.ready === r.replicas).length
  const abnormalCount = resources.filter((r) => r.status === 'Failed' || r.status === 'CrashLoopBackOff' || (r.replicas > 0 && r.ready === 0)).length

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
        setCurrentStep(0)
        basicForm.resetFields()
        containerForm.resetFields()
        fetchResources()
        return
      }

      const basic = await basicForm.validateFields()
      const container = await containerForm.validateFields()
      setCreating(true)

      const params = {
        name: basic.name,
        namespace: basic.namespace,
        replicas: basic.replicas || 1,
        labels: basic.labels ? Object.fromEntries(
          (basic.labels as string).split(',').map((l: string) => l.trim().split('='))
        ) : undefined,
        image: container.image,
        ports: container.ports?.filter((p: { containerPort: number }) => p.containerPort).map(
          (p: { containerPort: number; protocol?: string }) => ({ containerPort: p.containerPort, protocol: p.protocol || 'TCP' })
        ),
        env: container.env?.filter((e: { name: string; value: string }) => e.name).map(
          (e: { name: string; value: string }) => ({ name: e.name, value: e.value })
        ),
        cpu_request: container.cpu_request,
        cpu_limit: container.cpu_limit,
        memory_request: container.memory_request,
        memory_limit: container.memory_limit,
        schedule: kind === 'CronJob' ? basic.schedule : undefined,
      }

      const createFn = {
        Deployment: k8sService.createDeployment,
        StatefulSet: k8sService.createStatefulSet,
        DaemonSet: k8sService.createDaemonSet,
        CronJob: k8sService.createCronJob,
      }[kind]

      await createFn(selectedCluster, params)
      message.success(`${config.title}创建成功`)
      setCreateVisible(false)
      setCurrentStep(0)
      basicForm.resetFields()
      containerForm.resetFields()
      fetchResources()
    } catch { message.error('操作失败') }
    finally { setCreating(false) }
  }

  const handleDelete = async (record: K8sResource) => {
    try {
      const deleteFn = {
        Deployment: k8sService.deleteDeployment,
        StatefulSet: k8sService.deleteStatefulSet,
        DaemonSet: k8sService.deleteDaemonSet,
        CronJob: k8sService.deleteCronJob,
      }[kind]
      await deleteFn(selectedCluster, record.namespace, record.name)
      message.success('删除成功')
      fetchResources()
    } catch { message.error('删除失败') }
  }

  const handleScale = async () => {
    if (!scaleTarget) return
    try {
      const scaleFn = kind === 'Deployment' ? k8sService.scaleDeployment : k8sService.scaleStatefulSet
      await scaleFn(selectedCluster, scaleTarget.namespace, scaleTarget.name, scaleReplicas)
      message.success('伸缩成功')
      setScaleVisible(false)
      fetchResources()
    } catch { message.error('操作失败') }
  }

  const handleRestart = async (record: K8sResource) => {
    try {
      await k8sService.restartDeployment(selectedCluster, record.namespace, record.name)
      message.success('重启已触发')
      fetchResources()
    } catch { message.error('操作失败') }
  }

  const loadDetailYaml = async (force = false) => {
    if (!currentResource || !selectedCluster) return
    if (detailYaml && !force) return
    setDetailYamlLoading(true)
    try {
      const res = await k8sService.getYaml(selectedCluster, {
        kind,
        name: currentResource.name,
        namespace: currentResource.namespace,
      })
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
        kind,
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
        fetchResources()
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
      await k8sService.applyYaml(selectedCluster, {
        yaml: yamlText,
        namespace: yamlNamespace || undefined,
        dry_run: true,
      })
      message.success('校验通过')
    } catch { message.error('操作失败') }
    finally { setYamlActionLoading(false) }
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
    setYamlLoading(true)
    try {
      const res = await k8sService.getYaml(selectedCluster, { kind, name: record.name, namespace: record.namespace })
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
    } catch { message.error('操作失败') }
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
    } catch { message.error('操作失败') }
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
      fetchResources()
    } catch { message.error('操作失败') }
    finally { setYamlLoading(false) }
  }

  const columns: ColumnsType<K8sResource> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 280,
      ellipsis: true,
      render: (name: string, record) => (
        <Tooltip title={name}>
          <a onClick={() => { setCurrentResource(record); setDetailVisible(true) }}>
            {name}
          </a>
        </Tooltip>
      ),
    },
    { title: '命名空间', dataIndex: 'namespace', key: 'namespace', width: 140 },
    {
      title: '镜像',
      dataIndex: 'images',
      key: 'images',
      ellipsis: true,
      render: (images: string[]) => images?.join(', ') || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (s: string) => {
        const colorMap: Record<string, string> = {
          Running: 'green', Active: 'green', Available: 'green',
          Pending: 'orange', Progressing: 'blue',
          Failed: 'red', CrashLoopBackOff: 'red',
        }
        return <Tag color={colorMap[s] || 'default'}>{s}</Tag>
      },
    },
  ]

  // Add replicas column for Deployment/StatefulSet
  if (kind === 'Deployment' || kind === 'StatefulSet') {
    columns.splice(3, 0, {
      title: '副本',
      key: 'replicas',
      width: 80,
      render: (_, r) => (
        <span style={{ color: r.ready === r.replicas ? '#52c41a' : '#faad14' }}>
          {r.ready}/{r.replicas}
        </span>
      ),
    })
  }

  // Add schedule column for CronJob
  if (kind === 'CronJob') {
    columns.splice(3, 0, {
      title: '调度表达式',
      dataIndex: 'schedule',
      key: 'schedule',
      width: 150,
      render: (s: string) => <code>{s || '-'}</code>,
    })
  }

  columns.push(
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
      width: kind === 'Deployment' ? 200 : kind === 'StatefulSet' ? 160 : 120,
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="link"
            size="small"
            onClick={() => {
              setCurrentResource(record)
              setDetailTab('detail')
              setDetailYaml('')
              setDetailVisible(true)
            }}
          >
            详情
          </Button>
          <Button type="link" size="small" onClick={() => openYamlEditor(record)}>
            YAML
          </Button>
          {(kind === 'Deployment' || kind === 'StatefulSet') && (
            <Button
              type="link"
              size="small"
              icon={<ArrowsAltOutlined />}
              onClick={() => {
                setScaleTarget(record)
                setScaleReplicas(record.replicas)
                setScaleVisible(true)
              }}
            >
              伸缩
            </Button>
          )}
          {kind === 'Deployment' && (
            <Popconfirm title="确认重启此 Deployment？" onConfirm={() => handleRestart(record)}>
              <Button type="link" size="small" icon={<RedoOutlined />}>重启</Button>
            </Popconfirm>
          )}
          <Popconfirm title={`确认删除 ${record.name}？`} onConfirm={() => handleDelete(record)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  )

  const steps = [
    { title: '基本信息' },
    { title: '容器配置' },
    { title: '确认' },
  ]

  const renderStepContent = () => {
    if (currentStep === 0) {
      return (
        <Form form={basicForm} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }, { pattern: /^[a-z0-9][a-z0-9-]*$/, message: '小写字母、数字、中划线' }]}>
            <Input placeholder="例如: my-app" />
          </Form.Item>
          <Form.Item name="namespace" label="命名空间" rules={[{ required: true, message: '请选择命名空间' }]}>
            <Select placeholder="选择命名空间">
              {namespaces.map((ns) => (
                <Select.Option key={ns.name} value={ns.name}>{ns.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          {(kind === 'Deployment' || kind === 'StatefulSet') && (
            <Form.Item name="replicas" label="副本数" initialValue={1}>
              <InputNumber min={1} max={100} style={{ width: '100%' }} />
            </Form.Item>
          )}
          {kind === 'CronJob' && (
            <Form.Item name="schedule" label="调度表达式 (Cron)" rules={[{ required: true, message: '请输入 Cron 表达式' }]}>
              <Input placeholder="例如: */5 * * * *" />
            </Form.Item>
          )}
          <Form.Item name="labels" label="标签" extra="格式: key1=value1,key2=value2">
            <Input placeholder="app=myapp,env=prod" />
          </Form.Item>
        </Form>
      )
    }
    if (currentStep === 1) {
      return (
        <Form form={containerForm} layout="vertical">
          <Form.Item name="image" label="容器镜像" rules={[{ required: true, message: '请输入镜像地址' }]}>
            <Input placeholder="例如: nginx:1.24" />
          </Form.Item>
          <Form.List name="ports">
            {(fields, { add, remove }) => (
              <>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>端口映射</div>
                {fields.map(({ key, name, ...restField }) => (
                  <Space key={key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                    <Form.Item {...restField} name={[name, 'containerPort']} noStyle>
                      <InputNumber placeholder="容器端口" min={1} max={65535} style={{ width: 120 }} />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'protocol']} noStyle initialValue="TCP">
                      <Select style={{ width: 80 }}>
                        <Select.Option value="TCP">TCP</Select.Option>
                        <Select.Option value="UDP">UDP</Select.Option>
                      </Select>
                    </Form.Item>
                    <MinusCircleOutlined onClick={() => remove(name)} style={{ color: '#ff4d4f' }} />
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} style={{ marginBottom: 16 }}>
                  添加端口
                </Button>
              </>
            )}
          </Form.List>
          <Form.List name="env">
            {(fields, { add, remove }) => (
              <>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>环境变量</div>
                {fields.map(({ key, name, ...restField }) => (
                  <Space key={key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                    <Form.Item {...restField} name={[name, 'name']} noStyle>
                      <Input placeholder="变量名" style={{ width: 160 }} />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'value']} noStyle>
                      <Input placeholder="变量值" style={{ width: 200 }} />
                    </Form.Item>
                    <MinusCircleOutlined onClick={() => remove(name)} style={{ color: '#ff4d4f' }} />
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} style={{ marginBottom: 16 }}>
                  添加环境变量
                </Button>
              </>
            )}
          </Form.List>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="cpu_request" label="CPU Request">
                <Input placeholder="例如: 100m" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="cpu_limit" label="CPU Limit">
                <Input placeholder="例如: 500m" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="memory_request" label="Memory Request">
                <Input placeholder="例如: 128Mi" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="memory_limit" label="Memory Limit">
                <Input placeholder="例如: 512Mi" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      )
    }
    // Step 2: Confirm
    const basicValues = basicForm.getFieldsValue()
    const containerValues = containerForm.getFieldsValue()
    return (
      <Descriptions bordered column={1} size="small">
        <Descriptions.Item label="名称">{basicValues.name}</Descriptions.Item>
        <Descriptions.Item label="命名空间">{basicValues.namespace}</Descriptions.Item>
        {(kind === 'Deployment' || kind === 'StatefulSet') && (
          <Descriptions.Item label="副本数">{basicValues.replicas || 1}</Descriptions.Item>
        )}
        {kind === 'CronJob' && (
          <Descriptions.Item label="调度表达式">{basicValues.schedule}</Descriptions.Item>
        )}
        {basicValues.labels && (
          <Descriptions.Item label="标签">{basicValues.labels}</Descriptions.Item>
        )}
        <Descriptions.Item label="镜像">{containerValues.image}</Descriptions.Item>
        {containerValues.ports?.length > 0 && (
          <Descriptions.Item label="端口">
            {containerValues.ports.map((p: { containerPort: number; protocol?: string }, i: number) =>
              p.containerPort ? <Tag key={i}>{p.containerPort}/{p.protocol || 'TCP'}</Tag> : null
            )}
          </Descriptions.Item>
        )}
        {containerValues.env?.length > 0 && (
          <Descriptions.Item label="环境变量">
            {containerValues.env.map((e: { name: string; value: string }, i: number) =>
              e.name ? <Tag key={i}>{e.name}={e.value}</Tag> : null
            )}
          </Descriptions.Item>
        )}
        {(containerValues.cpu_request || containerValues.cpu_limit) && (
          <Descriptions.Item label="CPU">{containerValues.cpu_request || '-'} / {containerValues.cpu_limit || '-'}</Descriptions.Item>
        )}
        {(containerValues.memory_request || containerValues.memory_limit) && (
          <Descriptions.Item label="内存">{containerValues.memory_request || '-'} / {containerValues.memory_limit || '-'}</Descriptions.Item>
        )}
      </Descriptions>
    )
  }

  return (
    <div className="page-shell fade-in">
      <div className="page-hero">
        <div>
          <div className="page-hero-title">{config.title}</div>
          <p className="page-hero-subtitle">{config.desc}</p>
        </div>
        <div className="page-hero-actions">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              const defaultNs = selectedNs || namespaces[0]?.name || 'default'
              setCreateMode('form')
              setYamlTemplate('basic')
              setYamlNamespace(defaultNs)
              setYamlText(workloadYamlTemplate(kind, defaultNs, 'basic'))
              setCurrentStep(0)
              basicForm.resetFields()
              containerForm.resetFields()
              setCreateVisible(true)
            }}
          >
            创建{config.title}
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchResources}>刷新</Button>
        </div>
      </div>

      <div className="metric-grid">
        <Card className="metric-card metric-card--primary" bordered={false}>
          <Statistic title="总数" value={resources.length} prefix={<AppstoreOutlined style={{ color: '#0ea5e9' }} />} />
        </Card>
        <Card className="metric-card metric-card--success" bordered={false}>
          <Statistic title="正常" value={runningCount} prefix={<CheckCircleOutlined style={{ color: '#22c55e' }} />} />
        </Card>
        <Card className="metric-card metric-card--danger" bordered={false}>
          <Statistic title="异常" value={abnormalCount} prefix={<CloseCircleOutlined style={{ color: '#ef4444' }} />} />
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
              placeholder={`搜索${config.title}`}
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

      {/* Detail Drawer */}
      <Drawer
        title={`${config.title}详情`}
        width={600}
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
      >
        {currentResource && (
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
                  <Descriptions bordered column={1} style={{ marginBottom: 24 }}>
                    <Descriptions.Item label="名称">{currentResource.name}</Descriptions.Item>
                    <Descriptions.Item label="命名空间">{currentResource.namespace}</Descriptions.Item>
                    <Descriptions.Item label="类型">{kind}</Descriptions.Item>
                    <Descriptions.Item label="状态">
                      <Tag color={
                        currentResource.status === 'Running' || currentResource.status === 'Active' ? 'green' :
                        currentResource.status === 'Failed' ? 'red' : 'orange'
                      }>{currentResource.status}</Tag>
                    </Descriptions.Item>
                    {(kind === 'Deployment' || kind === 'StatefulSet') && (
                      <Descriptions.Item label="副本">{currentResource.ready}/{currentResource.replicas}</Descriptions.Item>
                    )}
                    {kind === 'CronJob' && currentResource.schedule && (
                      <Descriptions.Item label="调度表达式"><code>{currentResource.schedule}</code></Descriptions.Item>
                    )}
                    <Descriptions.Item label="镜像">
                      {currentResource.images?.map((img, i) => (
                        <Tag key={i} style={{ marginBottom: 4 }}>{img}</Tag>
                      ))}
                    </Descriptions.Item>
                    <Descriptions.Item label="创建时间">
                      {dayjs(currentResource.created_at).format('YYYY-MM-DD HH:mm:ss')}
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
                      <Button type="primary" onClick={() => openYamlEditor(currentResource)}>编辑 YAML</Button>
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

      {/* Create Modal */}
      <Modal
        title={`创建${config.title}`}
        open={createVisible}
        onCancel={() => { setCreateVisible(false); setCurrentStep(0) }}
        width={640}
        footer={
          createMode === 'yaml' ? (
            <Space>
              <Button onClick={() => { setCreateVisible(false); setCurrentStep(0) }}>取消</Button>
              <Button type="primary" loading={creating} onClick={handleCreate}>应用 YAML</Button>
            </Space>
          ) : (
            <Space>
              {currentStep > 0 && (
                <Button onClick={() => setCurrentStep(currentStep - 1)}>上一步</Button>
              )}
              {currentStep < 2 && (
                <Button type="primary" onClick={async () => {
                  if (currentStep === 0) {
                    await basicForm.validateFields()
                  } else if (currentStep === 1) {
                    await containerForm.validateFields()
                  }
                  setCurrentStep(currentStep + 1)
                }}>下一步</Button>
              )}
              {currentStep === 2 && (
                <Button type="primary" loading={creating} onClick={handleCreate}>确认创建</Button>
              )}
            </Space>
          )
        }
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
              setYamlTemplate('basic')
              setYamlNamespace(defaultNs)
              setYamlText(workloadYamlTemplate(kind, defaultNs, 'basic'))
            }
            if (mode === 'form') {
              setCurrentStep(0)
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
                  const next = value as 'basic' | 'probes' | 'resources'
                  const ns = yamlNamespace || selectedNs || namespaces[0]?.name || 'default'
                  setYamlTemplate(next)
                  setYamlText(workloadYamlTemplate(kind, ns, next))
                }}
                options={[
                  { label: '基础模板', value: 'basic' },
                  { label: '带探针', value: 'probes' },
                  { label: '带资源限制', value: 'resources' },
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
              提示：直接粘贴 kubectl 导出的 YAML 即可，系统会自动忽略 status 字段。
            </Typography.Text>
          </Form>
        ) : (
          <>
            <Steps current={currentStep} items={steps} style={{ marginBottom: 24 }} />
            {renderStepContent()}
          </>
        )}
      </Modal>

      {/* Scale Modal */}
      <Modal
        title={`伸缩 - ${scaleTarget?.name}`}
        open={scaleVisible}
        onCancel={() => setScaleVisible(false)}
        onOk={handleScale}
      >
        <div style={{ padding: '16px 0' }}>
          <span>副本数: </span>
          <InputNumber min={0} max={100} value={scaleReplicas} onChange={(v) => setScaleReplicas(v || 0)} />
          <span style={{ marginLeft: 8, color: '#999' }}>当前: {scaleTarget?.replicas || 0}</span>
        </div>
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
            提示：YAML 可包含多个资源（---），会按顺序应用。
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

export default WorkloadList
