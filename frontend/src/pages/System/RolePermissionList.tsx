import { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  message,
  Tag,
  Tree,
  Tabs,
  Popconfirm,
  Row,
  Col,
  Checkbox,
  Divider,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SafetyOutlined,
  SaveOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { DataNode } from 'antd/es/tree'
import {
  getPermissions,
  createRole,
  updateRole,
  deleteRole,
  setRolePermissions,
  getRolePermissions,
  Permission,
  Role,
  ResourceLabels,
  ActionLabels,
} from '@/services/permission'
import { userService } from '@/services/user'

export default function RolePermissionList() {
  const [loading, setLoading] = useState(false)
  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])

  // 角色弹窗
  const [roleModalVisible, setRoleModalVisible] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [form] = Form.useForm()

  // 权限配置
  const [currentRole, setCurrentRole] = useState<Role | null>(null)
  const [checkedKeys, setCheckedKeys] = useState<string[]>([])
  const [permissionModalVisible, setPermissionModalVisible] = useState(false)
  const [saving, setSaving] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [rolesRes, permsRes] = await Promise.all([
        userService.listRoles(),
        getPermissions(),
      ])
      // 处理角色数据
      if (rolesRes.data) {
        setRoles(rolesRes.data || [])
      }
      // 处理权限数据
      if (permsRes.code === 0) {
        setPermissions(permsRes.data || [])
      } else if (Array.isArray(permsRes)) {
        setPermissions(permsRes)
      }
    } catch {
      message.error('获取数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // 创建角色
  const handleCreateRole = () => {
    setEditingRole(null)
    form.resetFields()
    setRoleModalVisible(true)
  }

  // 编辑角色
  const handleEditRole = (role: Role) => {
    setEditingRole(role)
    form.setFieldsValue(role)
    setRoleModalVisible(true)
  }

  // 删除角色
  const handleDeleteRole = async (id: string) => {
    try {
      const res = await deleteRole(id)
      if (res.code === 0) {
        message.success('删除成功')
        fetchData()
      } else {
        message.error(res.message || '删除失败')
      }
    } catch (e) {
      message.error('删除失败')
    }
  }

  // 提交角色
  const handleSubmitRole = async () => {
    try {
      const values = await form.validateFields()
      let res
      if (editingRole) {
        res = await updateRole(editingRole.id, values)
      } else {
        res = await createRole(values)
      }
      if (res.code === 0) {
        message.success(editingRole ? '更新成功' : '创建成功')
        setRoleModalVisible(false)
        fetchData()
      } else {
        message.error(res.message || '操作失败')
      }
    } catch (e) {
      // 表单验证失败
    }
  }

  // 配置权限
  const handleConfigPermissions = async (role: Role) => {
    setCurrentRole(role)
    try {
      const res = await getRolePermissions(role.id)
      if (res.code === 0) {
        const permIds = (res.data || []).map((p: Permission) => p.id)
        setCheckedKeys(permIds)
      } else if (Array.isArray(res)) {
        setCheckedKeys(res.map((p: Permission) => p.id))
      }
      setPermissionModalVisible(true)
    } catch (e) {
      setCheckedKeys([])
      setPermissionModalVisible(true)
    }
  }

  // 保存权限
  const handleSavePermissions = async () => {
    if (!currentRole) return
    setSaving(true)
    try {
      const res = await setRolePermissions(currentRole.id, checkedKeys)
      if (res.code === 0) {
        message.success('权限配置成功')
        setPermissionModalVisible(false)
        fetchData()
      } else {
        message.error(res.message || '配置失败')
      }
    } catch (e) {
      message.error('配置失败')
    } finally {
      setSaving(false)
    }
  }

  // 构建权限树
  const buildPermissionTree = (perms: Permission[]): DataNode[] => {
    return perms.map((p) => ({
      key: p.id,
      title: (
        <span>
          {p.name}
          {p.resource && (
            <Tag color="blue" style={{ marginLeft: 8 }}>
              {ResourceLabels[p.resource] || p.resource}
            </Tag>
          )}
          {p.action && (
            <Tag color="green" style={{ marginLeft: 4 }}>
              {ActionLabels[p.action] || p.action}
            </Tag>
          )}
        </span>
      ),
      children: p.children ? buildPermissionTree(p.children) : undefined,
    }))
  }

  // 按资源分组权限
  const groupedPermissions = permissions.reduce((acc, p) => {
    const resource = p.resource || 'other'
    if (!acc[resource]) {
      acc[resource] = []
    }
    acc[resource].push(p)
    return acc
  }, {} as Record<string, Permission[]>)

  const columns: ColumnsType<Role> = [
    {
      title: '角色名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<SafetyOutlined />}
            onClick={() => handleConfigPermissions(record)}
          >
            配置权限
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditRole(record)}
          >
            编辑
          </Button>
          {record.code !== 'admin' && (
            <Popconfirm
              title="确定删除此角色?"
              onConfirm={() => handleDeleteRole(record.id)}
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <Card
      title="角色权限管理"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateRole}>
          新建角色
        </Button>
      }
    >
      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={roles}
        scroll={{ x: 900 }}
        pagination={false}
      />

      {/* 角色弹窗 */}
      <Modal
        title={editingRole ? '编辑角色' : '新建角色'}
        open={roleModalVisible}
        onOk={handleSubmitRole}
        onCancel={() => setRoleModalVisible(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="角色名称"
            rules={[{ required: true, message: '请输入角色名称' }]}
          >
            <Input placeholder="请输入角色名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="请输入描述" rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 权限配置弹窗 */}
      <Modal
        title={`配置权限 - ${currentRole?.name}`}
        open={permissionModalVisible}
        onCancel={() => setPermissionModalVisible(false)}
        width={800}
        footer={[
          <Button key="cancel" onClick={() => setPermissionModalVisible(false)}>
            取消
          </Button>,
          <Button
            key="save"
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={handleSavePermissions}
          >
            保存
          </Button>,
        ]}
      >
        <Tabs
          items={[
            {
              key: 'group',
              label: '按模块分组',
              children: (
                <div style={{ maxHeight: 500, overflow: 'auto' }}>
                  {Object.entries(groupedPermissions).map(([resource, perms]) => (
                    <div key={resource} style={{ marginBottom: 16 }}>
                      <Divider orientation="left">
                        {ResourceLabels[resource] || resource}
                      </Divider>
                      <Checkbox.Group
                        value={checkedKeys}
                        onChange={(values) => {
                          // 合并其他资源的选中项
                          const otherKeys = checkedKeys.filter(
                            (k) => !perms.some((p) => p.id === k)
                          )
                          setCheckedKeys([...otherKeys, ...(values as string[])])
                        }}
                      >
                        <Row gutter={[16, 8]}>
                          {perms.map((p) => (
                            <Col span={8} key={p.id}>
                              <Checkbox value={p.id}>
                                {p.name}
                                {p.action && (
                                  <Tag color="green" style={{ marginLeft: 4 }}>
                                    {ActionLabels[p.action] || p.action}
                                  </Tag>
                                )}
                              </Checkbox>
                            </Col>
                          ))}
                        </Row>
                      </Checkbox.Group>
                    </div>
                  ))}
                </div>
              ),
            },
            {
              key: 'tree',
              label: '权限树',
              children: (
                <div style={{ maxHeight: 500, overflow: 'auto' }}>
                  <Tree
                    checkable
                    checkedKeys={checkedKeys}
                    onCheck={(keys) => setCheckedKeys(keys as string[])}
                    treeData={buildPermissionTree(permissions)}
                    defaultExpandAll
                  />
                </div>
              ),
            },
          ]}
        />
      </Modal>
    </Card>
  )
}
