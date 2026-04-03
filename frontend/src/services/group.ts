import api, { PageData } from './api'

export interface UserGroup {
  id: string
  name: string
  description: string
  parent_id: string | null
  users?: User[]
  roles?: Role[]
  created_by: string
  created_at: string
}

export interface User {
  id: string
  username: string
  email: string
  real_name: string
  status: number
}

export interface Role {
  id: string
  name: string
  code: string
}

export interface GroupNode extends UserGroup {
  children?: GroupNode[]
}

// 获取分组列表
export const getGroups = (params?: { page?: number; page_size?: number; keyword?: string }) =>
  api.get<unknown, { data: PageData<UserGroup> }>('/user-groups', { params })

// 获取分组树
export const getGroupTree = () =>
  api.get<unknown, { data: GroupNode[] }>('/user-groups/tree')

// 获取分组详情
export const getGroup = (id: string) =>
  api.get<unknown, { data: UserGroup }>(`/user-groups/${id}`)

// 创建分组
export const createGroup = (data: { name: string; description?: string; parent_id?: string }) =>
  api.post<unknown, { data: UserGroup }>('/user-groups', data)

// 更新分组
export const updateGroup = (id: string, data: { name?: string; description?: string; parent_id?: string | null }) =>
  api.put<unknown, { data: UserGroup }>(`/user-groups/${id}`, data)

// 删除分组
export const deleteGroup = (id: string) =>
  api.delete(`/user-groups/${id}`)

// 获取分组成员
export const getGroupMembers = (id: string) =>
  api.get<unknown, { data: User[] }>(`/user-groups/${id}/members`)

// 添加分组成员
export const addGroupMembers = (id: string, userIds: string[]) =>
  api.post(`/user-groups/${id}/members`, { user_ids: userIds })

// 移除分组成员
export const removeGroupMember = (groupId: string, userId: string) =>
  api.delete(`/user-groups/${groupId}/members/${userId}`)

// 设置分组角色
export const setGroupRoles = (id: string, roleIds: string[]) =>
  api.put(`/user-groups/${id}/roles`, { role_ids: roleIds })
