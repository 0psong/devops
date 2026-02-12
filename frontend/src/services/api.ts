import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { message } from 'antd'

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
})

// Request interceptor
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error: AxiosError) => {
    return Promise.reject(error)
  }
)

// Map HTTP status codes to user-friendly messages (avoid leaking internal details)
const httpErrorMessages: Record<number, string> = {
  400: '请求参数错误',
  401: '登录已过期，请重新登录',
  403: '无权限访问该资源',
  404: '请求的资源不存在',
  408: '请求超时，请重试',
  429: '请求过于频繁，请稍后再试',
  500: '服务器内部错误',
  502: '网关错误',
  503: '服务暂时不可用',
}

// Response interceptor
api.interceptors.response.use(
  (response) => {
    const data = response.data
    if (data.code !== 0) {
      message.error(data.message || '请求失败')
      return Promise.reject(new Error(data.message))
    }
    return data
  },
  (error: AxiosError<{ message?: string }>) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      if (window.location.pathname !== '/login') {
        window.location.replace('/login')
      }
      return Promise.reject(error)
    }
    // Use generic error messages instead of exposing backend details
    const status = error.response?.status || 0
    const userMessage = httpErrorMessages[status] || '网络错误，请检查网络连接'
    message.error(userMessage)
    return Promise.reject(error)
  }
)

export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

export interface PageData<T> {
  list: T[]
  total: number
  page: number
  page_size: number
}

export default api
