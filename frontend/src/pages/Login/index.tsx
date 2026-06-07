import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, message } from 'antd'
import {
  UserOutlined,
  LockOutlined,
  CloudServerOutlined,
} from '@ant-design/icons'
import { authService } from '@/services/auth'
import { useAuthStore } from '@/stores/auth'

const Login: React.FC = () => {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)
  const [loading, setLoading] = React.useState(false)

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true)
    try {
      const res = await authService.login(values)
      setAuth(res.data.token, res.data.user)
      message.success('登录成功')
      navigate('/')
    } catch {
      // Error handled by interceptor
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <section className="login-card notranslate" translate="no">
        <div className="login-card-header">
          <div className="login-mark">
            <CloudServerOutlined />
          </div>
          <h1 className="login-card-title">运维管理平台</h1>
        </div>

        <Form
          name="login"
          onFinish={onFinish}
          autoComplete="off"
          layout="vertical"
          requiredMark={false}
          className="login-form"
        >
          <Form.Item
            label="用户名"
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="请输入用户名"
              size="large"
            />
          </Form.Item>

          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请输入密码"
              size="large"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              size="large"
              className="login-btn"
            >
              登录
            </Button>
          </Form.Item>
        </Form>
      </section>
    </div>
  )
}

export default Login
