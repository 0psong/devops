import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Row, Col, Card, Statistic, Typography, Progress, Spin, message } from 'antd'
import {
  DesktopOutlined,
  CloudServerOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  RocketOutlined,
  ClusterOutlined,
  SettingOutlined,
  PlusOutlined,
  ThunderboltOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'
import { dashboardService, DashboardStats, DashboardActivity, DeployTrend } from '@/services/dashboard'

echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, CanvasRenderer])

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

const { Text } = Typography

const Dashboard: React.FC = () => {
  const navigate = useNavigate()

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [activities, setActivities] = useState<DashboardActivity[]>([])
  const [deployTrend, setDeployTrend] = useState<DeployTrend[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, activitiesRes, trendRes] = await Promise.all([
          dashboardService.getStats(),
          dashboardService.getActivities(),
          dashboardService.getDeployTrend(),
        ])
        setStats(statsRes.data)
        setActivities(activitiesRes.data || [])
        setDeployTrend(trendRes.data || [])
      } catch {
        message.error('获取仪表盘数据失败')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const palette = {
    primary: '#0ea5e9',
    accent: '#14b8a6',
    success: '#22c55e',
    warn: '#f59e0b',
    danger: '#ef4444',
    ink: '#0f172a',
    muted: '#64748b',
  }

  const cpuOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.96)',
      borderColor: '#eee',
      borderWidth: 1,
      textStyle: { color: palette.ink },
      boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
    },
    grid: { top: 20, right: 20, bottom: 30, left: 50 },
    xAxis: {
      type: 'category',
      data: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'],
      axisLine: { lineStyle: { color: '#eef0f3' } },
      axisLabel: { color: palette.muted, fontSize: 11 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      max: 100,
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#f5f5f7', type: 'dashed' } },
      axisLabel: { color: palette.muted, fontSize: 11, formatter: '{value}%' },
    },
    series: [
      {
        data: [30, 25, 45, 60, 55, 40, 35],
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        showSymbol: false,
        lineStyle: { width: 3, color: palette.primary },
        itemStyle: { color: palette.primary, borderWidth: 2, borderColor: '#fff' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(14, 165, 233, 0.25)' },
              { offset: 1, color: 'rgba(14, 165, 233, 0.02)' },
            ],
          },
        },
      },
    ],
  }

  const memoryOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.96)',
      borderColor: '#eee',
      borderWidth: 1,
      textStyle: { color: palette.ink },
    },
    grid: { top: 20, right: 20, bottom: 30, left: 50 },
    xAxis: {
      type: 'category',
      data: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'],
      axisLine: { lineStyle: { color: '#eef0f3' } },
      axisLabel: { color: palette.muted, fontSize: 11 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      max: 100,
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#f5f5f7', type: 'dashed' } },
      axisLabel: { color: palette.muted, fontSize: 11, formatter: '{value}%' },
    },
    series: [
      {
        data: [65, 68, 70, 72, 75, 73, 70],
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        showSymbol: false,
        lineStyle: { width: 3, color: palette.accent },
        itemStyle: { color: palette.accent, borderWidth: 2, borderColor: '#fff' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(20, 184, 166, 0.25)' },
              { offset: 1, color: 'rgba(20, 184, 166, 0.02)' },
            ],
          },
        },
      },
    ],
  }

  const deployOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.96)',
      borderColor: '#eee',
      borderWidth: 1,
      textStyle: { color: palette.ink },
    },
    grid: { top: 20, right: 20, bottom: 30, left: 50 },
    xAxis: {
      type: 'category',
      data: deployTrend.map(d => d.date),
      axisLine: { lineStyle: { color: '#eef0f3' } },
      axisLabel: { color: palette.muted, fontSize: 11 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#f5f5f7', type: 'dashed' } },
      axisLabel: { color: palette.muted, fontSize: 11 },
    },
    series: [
      {
        data: deployTrend.map(d => d.count),
        type: 'bar',
        barWidth: '50%',
        itemStyle: {
          borderRadius: [8, 8, 0, 0],
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#38bdf8' },
              { offset: 1, color: '#0ea5e9' },
            ],
          },
        },
      },
    ],
  }

  const quickActions = [
    { icon: <PlusOutlined />, title: '添加主机', path: '/monitor/hosts' },
    { icon: <RocketOutlined />, title: '部署应用', path: '/deploy/apps' },
    { icon: <ClusterOutlined />, title: 'K8s 集群', path: '/k8s/clusters' },
    { icon: <SettingOutlined />, title: '配置管理', path: '/config' },
  ]

  return (
    <Spin spinning={loading}>
    <div className="page-shell fade-in">
      <div className="page-hero">
        <div>
          <div className="page-hero-title">仪表盘</div>
          <p className="page-hero-subtitle">欢迎回来，这是您的运维概览</p>
        </div>
      </div>

      {/* Stat cards */}
      <Row gutter={[20, 20]}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card stat-card-blue" bordered={false}>
            <Statistic
              title="主机总数"
              value={stats?.host_total || 0}
              prefix={<DesktopOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card stat-card-purple" bordered={false}>
            <Statistic
              title="应用总数"
              value={stats?.app_total || 0}
              prefix={<CloudServerOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card stat-card-green" bordered={false}>
            <Statistic
              title="在线主机"
              value={stats?.host_online || 0}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card stat-card-orange" bordered={false}>
            <Statistic
              title="告警数量"
              value={stats?.alert_total || 0}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Charts */}
      <Row gutter={[20, 20]} style={{ marginTop: 20 }}>
        <Col xs={24} lg={8}>
          <Card className="chart-card" title="CPU 使用率" bordered={false}>
            <ReactEChartsCore echarts={echarts} option={cpuOption} style={{ height: 260 }} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card className="chart-card" title="内存使用率" bordered={false}>
            <ReactEChartsCore echarts={echarts} option={memoryOption} style={{ height: 260 }} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card className="chart-card" title="本周部署次数" bordered={false}>
            <ReactEChartsCore echarts={echarts} option={deployOption} style={{ height: 260 }} />
          </Card>
        </Col>
      </Row>

      {/* Bottom section */}
      <Row gutter={[20, 20]} style={{ marginTop: 20 }}>
        {/* Quick Actions */}
        <Col xs={24} lg={8}>
          <Card className="section-card" title="快捷操作" bordered={false}>
            <Row gutter={[12, 12]}>
              {quickActions.map((action) => (
                <Col span={12} key={action.title}>
                  <div
                    className="quick-action-card"
                    onClick={() => navigate(action.path)}
                  >
                    <div style={{ marginBottom: 8 }}>{action.icon}</div>
                    <Text style={{ fontSize: 13, fontWeight: 500 }}>{action.title}</Text>
                  </div>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>

        {/* Resource usage */}
        <Col xs={24} lg={8}>
          <Card className="section-card" title="资源概览" bordered={false}>
            <div style={{ padding: '4px 0' }}>
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ color: palette.muted }}>CPU 平均</Text>
                  <Text strong style={{ color: palette.primary }}>42%</Text>
                </div>
                <Progress
                  percent={42}
                  showInfo={false}
                  strokeColor={{ from: palette.primary, to: '#1d4ed8' }}
                  trailColor="#e2e8f0"
                  size="small"
                />
              </div>
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ color: palette.muted }}>内存平均</Text>
                  <Text strong style={{ color: palette.accent }}>71%</Text>
                </div>
                <Progress
                  percent={71}
                  showInfo={false}
                  strokeColor={{ from: palette.accent, to: '#22c55e' }}
                  trailColor="#e2e8f0"
                  size="small"
                />
              </div>
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ color: palette.muted }}>磁盘平均</Text>
                  <Text strong style={{ color: palette.warn }}>58%</Text>
                </div>
                <Progress
                  percent={58}
                  showInfo={false}
                  strokeColor={{ from: palette.warn, to: '#f97316' }}
                  trailColor="#e2e8f0"
                  size="small"
                />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ color: palette.muted }}>网络带宽</Text>
                  <Text strong style={{ color: palette.primary }}>23%</Text>
                </div>
                <Progress
                  percent={23}
                  showInfo={false}
                  strokeColor={{ from: '#38bdf8', to: palette.primary }}
                  trailColor="#e2e8f0"
                  size="small"
                />
              </div>
            </div>
          </Card>
        </Col>

        {/* Recent Activity */}
        <Col xs={24} lg={8}>
          <Card className="section-card" title="最近动态" bordered={false}>
            <div>
              {activities.map((item, i) => (
                <div className="activity-item" key={i}>
                  <div className="activity-dot" style={{ background: palette.primary }} />
                  <div className="activity-content">
                    <div className="activity-title">{item.title}</div>
                  </div>
                  <div className="activity-time">{dayjs(item.created_at).fromNow()}</div>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      {/* System Status */}
      <Row gutter={[20, 20]} style={{ marginTop: 20 }}>
        <Col xs={24}>
          <Card className="section-card" bordered={false}>
            <Row gutter={[40, 20]} align="middle">
              <Col>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, rgba(20, 184, 166, 0.12) 0%, rgba(34, 197, 94, 0.12) 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <SafetyCertificateOutlined style={{ fontSize: 24, color: palette.accent }} />
                  </div>
                  <div>
                    <Text style={{ fontSize: 13, color: palette.muted }}>系统状态</Text>
                    <div style={{ fontSize: 16, fontWeight: 600, color: palette.accent }}>运行正常</div>
                  </div>
                </div>
              </Col>
              <Col>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.12) 0%, rgba(56, 189, 248, 0.12) 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <ThunderboltOutlined style={{ fontSize: 24, color: palette.primary }} />
                  </div>
                  <div>
                    <Text style={{ fontSize: 13, color: palette.muted }}>今日部署</Text>
                    <div style={{ fontSize: 16, fontWeight: 600, color: palette.ink }}>{stats?.deploy_today || 0} 次</div>
                  </div>
                </div>
              </Col>
              <Col>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(249, 115, 22, 0.12) 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <WarningOutlined style={{ fontSize: 24, color: palette.warn }} />
                  </div>
                  <div>
                    <Text style={{ fontSize: 13, color: palette.muted }}>待处理告警</Text>
                    <div style={{ fontSize: 16, fontWeight: 600, color: palette.warn }}>{stats?.alert_total || 0} 条</div>
                  </div>
                </div>
              </Col>
              <Col>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.12) 0%, rgba(20, 184, 166, 0.12) 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <ClusterOutlined style={{ fontSize: 24, color: palette.primary }} />
                  </div>
                  <div>
                    <Text style={{ fontSize: 13, color: palette.muted }}>K8s 集群</Text>
                    <div style={{ fontSize: 16, fontWeight: 600, color: palette.ink }}>{stats?.cluster_total || 0} 个</div>
                  </div>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
    </Spin>
  )
}

export default Dashboard
