package service

import (
	"fmt"
	"time"

	"devops/internal/model"

	"gorm.io/gorm"
)

type DashboardStats struct {
	HostTotal    int64 `json:"host_total"`
	HostOnline   int64 `json:"host_online"`
	AppTotal     int64 `json:"app_total"`
	DeployTotal  int64 `json:"deploy_total"`
	DeployToday  int64 `json:"deploy_today"`
	ClusterTotal int64 `json:"cluster_total"`
	AlertTotal   int64 `json:"alert_total"`
	ConfigTotal  int64 `json:"config_total"`
}

type DashboardActivity struct {
	Title     string    `json:"title"`
	Type      string    `json:"type"`
	CreatedAt time.Time `json:"created_at"`
}

type DeployTrend struct {
	Date  string `json:"date"`
	Count int64  `json:"count"`
}

type DashboardService struct {
	db *gorm.DB
}

func NewDashboardService(db *gorm.DB) *DashboardService {
	return &DashboardService{db: db}
}

func (s *DashboardService) GetStats() (*DashboardStats, error) {
	stats := &DashboardStats{}
	today := time.Now().Truncate(24 * time.Hour)

	// Consolidate 8 separate COUNT queries into a single query (8 round-trips → 1)
	row := s.db.Raw(`
		SELECT
			(SELECT COUNT(*) FROM hosts WHERE deleted_at IS NULL) AS host_total,
			(SELECT COUNT(*) FROM hosts WHERE deleted_at IS NULL AND status = 1) AS host_online,
			(SELECT COUNT(*) FROM applications WHERE deleted_at IS NULL) AS app_total,
			(SELECT COUNT(*) FROM deployments WHERE deleted_at IS NULL) AS deploy_total,
			(SELECT COUNT(*) FROM deployments WHERE deleted_at IS NULL AND created_at >= ?) AS deploy_today,
			(SELECT COUNT(*) FROM clusters WHERE deleted_at IS NULL) AS cluster_total,
			(SELECT COUNT(*) FROM alert_histories WHERE deleted_at IS NULL AND status = 0) AS alert_total,
			(SELECT COUNT(*) FROM config_items WHERE deleted_at IS NULL) AS config_total
	`, today).Row()

	if err := row.Scan(
		&stats.HostTotal, &stats.HostOnline,
		&stats.AppTotal, &stats.DeployTotal, &stats.DeployToday,
		&stats.ClusterTotal, &stats.AlertTotal, &stats.ConfigTotal,
	); err != nil {
		// Fallback to individual queries if raw SQL fails (e.g. table name mismatch)
		s.db.Model(&model.Host{}).Count(&stats.HostTotal)
		s.db.Model(&model.Host{}).Where("status = 1").Count(&stats.HostOnline)
		s.db.Model(&model.Application{}).Count(&stats.AppTotal)
		s.db.Model(&model.Deployment{}).Count(&stats.DeployTotal)
		s.db.Model(&model.Deployment{}).Where("created_at >= ?", today).Count(&stats.DeployToday)
		s.db.Model(&model.Cluster{}).Count(&stats.ClusterTotal)
		s.db.Model(&model.AlertHistory{}).Where("status = 0").Count(&stats.AlertTotal)
		s.db.Model(&model.ConfigItem{}).Count(&stats.ConfigTotal)
	}

	return stats, nil
}

func (s *DashboardService) GetRecentActivities(limit int) ([]DashboardActivity, error) {
	var logs []model.AuditLog
	if err := s.db.Order("created_at DESC").Limit(limit).Find(&logs).Error; err != nil {
		return nil, err
	}

	var activities []DashboardActivity
	for _, log := range logs {
		activities = append(activities, DashboardActivity{
			Title:     fmt.Sprintf("%s %s了 %s %s", log.Username, actionName(log.Action), resourceName(log.Module), log.ResourceName),
			Type:      log.Action,
			CreatedAt: log.CreatedAt,
		})
	}
	return activities, nil
}

func (s *DashboardService) GetDeployTrend(days int) ([]DeployTrend, error) {
	var results []DeployTrend
	startDate := time.Now().AddDate(0, 0, -days).Truncate(24 * time.Hour)

	err := s.db.Model(&model.Deployment{}).
		Select("DATE(created_at) as date, COUNT(*) as count").
		Where("created_at >= ?", startDate).
		Group("DATE(created_at)").
		Order("date ASC").
		Scan(&results).Error

	return results, err
}

func actionName(action string) string {
	names := map[string]string{
		"create":  "创建",
		"update":  "更新",
		"delete":  "删除",
		"view":    "查看",
		"login":   "登录",
		"logout":  "登出",
		"deploy":  "部署",
		"execute": "执行",
	}
	if name, ok := names[action]; ok {
		return name
	}
	return action
}

func resourceName(module string) string {
	names := map[string]string{
		"user":    "用户",
		"host":    "主机",
		"app":     "应用",
		"deploy":  "部署",
		"config":  "配置",
		"cluster": "集群",
		"k8s":     "K8s资源",
		"auth":    "认证",
	}
	if name, ok := names[module]; ok {
		return name
	}
	return module
}
