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
  Popconfirm,
  Tag,
  Select,
  Transfer,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  TeamOutlined,
  UserAddOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { TransferProps } from 'antd'
import {
  getGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  getGroupMembers,
  addGroupMembers,
  removeGroupMember,
  setGroupRoles,
  UserGroup,
  User,
} from '@/services/group'
import { userService, Role } from '@/services/user'

export default function GroupList() {
  const [loading, setLoading] = useState(false)
  const [groups, setGroups] = useState<UserGroup[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [keyword, setKeyword] = useState('')

  // 创建/编辑弹窗
  const [modalVisible, setModalVisible] = useState(false)
  const [editingGroup, setEditingGroup] = useState<UserGroup | null>(null)
  const [form] = Form.useForm()

  // 成员管理弹窗
  const [memberModalVisible, setMemberModalVisible] = useState(false)
  const [currentGroup, setCurrentGroup] = useState<UserGroup | null>(null)
  const [members, setMembers] = useState<User[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [selectedUserKeys, setSelectedUserKeys] = useState<string[]>([])

  // 角色分配弹窗
  const [roleModalVisible, setRoleModalVisible] = useState(false)
  const [allRoles, setAllRoles] = useState<Role[]>([])

  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([])

  const fetchGroups = async () => {
    setLoading(true)
    try {
      const res = await getGroups({ page, page_size: pageSize, keyword })
      setGroups(res.data.list || [])
      setTotal(res.data.total)
    } catch {
      message.error('获取分组列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGroups()
  }, [page, pageSize, keyword])

  const handleCreate = () => {
    setEditingGroup(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEdit = (record: UserGroup) => {
    setEditingGroup(record)
    form.setFieldsValue(record)
    setModalVisible(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteGroup(id)
      message.success('删除成功')
      fetchGroups()
    } catch {
      message.error('删除失败')
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editingGroup) {
        await updateGroup(editingGroup.id, values)
      } else {
        await createGroup(values)
      }
      message.success(editingGroup ? '更新成功' : '创建成功')
      setModalVisible(false)
      fetchGroups()
    } catch {
      // 表单验证失败或 API 错误（interceptor 已处理提示）
    }
  }

  // 成员管理
  const handleManageMembers = async (group: UserGroup) => {
    setCurrentGroup(group)
    try {
      const [membersRes, usersRes] = await Promise.all([
        getGroupMembers(group.id),
        userService.list({ page: 1, page_size: 1000 })
      ])
      setMembers(membersRes.data || [])
      setSelectedUserKeys((membersRes.data || []).map((u: User) => u.id))
      if (usersRes.data?.list) {
        setAllUsers(usersRes.data.list || [])
      }
      setMemberModalVisible(true)
    } catch (e) {
      message.error('获取成员信息失败')
    }
  }

  const handleMemberChange: TransferProps['onChange'] = (targetKeys) => {
    setSelectedUserKeys(targetKeys as string[])
  }

  const handleSaveMembers = async () => {
    if (!currentGroup) return
    try {
      // 找出新增的成员
      const currentMemberIds = members.map(m => m.id)
      const toAdd = selectedUserKeys.filter(id => !currentMemberIds.includes(id))
      const toRemove = currentMemberIds.filter(id => !selectedUserKeys.includes(id))

      // 添加新成员
      if (toAdd.length > 0) {
        await addGroupMembers(currentGroup.id, toAdd)
      }
      // 移除成员
      for (const userId of toRemove) {
        await removeGroupMember(currentGroup.id, userId)
      }

      message.success('成员更新成功')
      setMemberModalVisible(false)
      fetchGroups()
    } catch (e) {
      message.error('更新成员失败')
    }
  }

  // 角色分配
  const handleManageRoles = async (group: UserGroup) => {
    setCurrentGroup(group)
    try {
      const rolesRes = await userService.listRoles()
      if (rolesRes.data) {
        setAllRoles(rolesRes.data || [])
      }
      setSelectedRoleIds((group.roles || []).map(r => r.id))
      setRoleModalVisible(true)
    } catch (e) {
      message.error('获取角色信息失败')
    }
  }

  const handleSaveRoles = async () => {
    if (!currentGroup) return
    try {
      await setGroupRoles(currentGroup.id, selectedRoleIds)
      message.success('角色分配成功')
      setRoleModalVisible(false)
      fetchGroups()
    } catch {
      message.error('分配角色失败')
    }
  }

  const columns: ColumnsType<UserGroup> = [
    {
      title: '分组名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '成员数',
      key: 'userCount',
      render: (_, record) => (record.users?.length || 0) + ' 人',
    },
    {
      title: '角色',
      key: 'roles',
      render: (_, record) => (
        <Space wrap>
          {(record.roles || []).map(role => (
            <Tag key={role.id} color="green">{role.name}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (t: string) => t?.split('T')[0],
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
            icon={<TeamOutlined />}
            onClick={() => handleManageMembers(record)}
          >
            成员
          </Button>
          <Button
            type="link"
            size="small"
            icon={<UserAddOutlined />}
            onClick={() => handleManageRoles(record)}
          >
            角色
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除此分组?"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <Card
      title="用户分组"
      extra={
        <Space>
          <Input.Search
            placeholder="搜索分组"
            allowClear
            onSearch={setKeyword}
            style={{ width: 200 }}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建分组
          </Button>
        </Space>
      }
    >
      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={groups}
        scroll={{ x: 1000 }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => {
            setPage(p)
            setPageSize(ps)
          },
        }}
      />

      {/* 创建/编辑弹窗 */}
      <Modal
        title={editingGroup ? '编辑分组' : '新建分组'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="分组名称"
            rules={[{ required: true, message: '请输入分组名称' }]}
          >
            <Input placeholder="请输入分组名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="请输入描述" rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 成员管理弹窗 */}
      <Modal
        title={`管理成员 - ${currentGroup?.name}`}
        open={memberModalVisible}
        onOk={handleSaveMembers}
        onCancel={() => setMemberModalVisible(false)}
        width={600}
      >
        <Transfer
          dataSource={allUsers.map(u => ({
            key: u.id,
            title: u.username,
            description: u.real_name || u.email,
          }))}
          targetKeys={selectedUserKeys}
          onChange={handleMemberChange}
          render={item => `${item.title} (${item.description})`}
          titles={['可选用户', '已选成员']}
          listStyle={{ width: 240, height: 300 }}
        />
      </Modal>

      {/* 角色分配弹窗 */}
      <Modal
        title={`分配角色 - ${currentGroup?.name}`}
        open={roleModalVisible}
        onOk={handleSaveRoles}
        onCancel={() => setRoleModalVisible(false)}
      >
        <Select
          mode="multiple"
          style={{ width: '100%' }}
          placeholder="选择角色"
          value={selectedRoleIds}
          onChange={setSelectedRoleIds}
          options={allRoles.map(r => ({
            value: r.id,
            label: r.name,
          }))}
        />
      </Modal>
    </Card>
  )
}
