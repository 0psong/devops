package repository

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"devops/internal/config"
	"devops/internal/model"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func InitDatabase(cfg *config.DatabaseConfig) (*gorm.DB, error) {
	dsn := fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.DBName, cfg.SSLMode,
	)

	// Use Warn log level in production to reduce I/O overhead
	logLevel := logger.Info
	if os.Getenv("SERVER_MODE") == "release" {
		logLevel = logger.Warn
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger:                 logger.Default.LogMode(logLevel),
		SkipDefaultTransaction: true, // Skip implicit transactions for single queries (performance)
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect database: %w", err)
	}

	// Configure connection pool with environment-aware settings
	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get underlying sql.DB: %w", err)
	}
	maxOpen := getEnvInt("DB_MAX_OPEN_CONNS", 50)
	maxIdle := getEnvInt("DB_MAX_IDLE_CONNS", 20)
	sqlDB.SetMaxOpenConns(maxOpen)
	sqlDB.SetMaxIdleConns(maxIdle)
	sqlDB.SetConnMaxLifetime(30 * time.Minute)
	sqlDB.SetConnMaxIdleTime(5 * time.Minute)

	// Auto migrate
	if err := db.AutoMigrate(
		&model.User{},
		&model.Role{},
		&model.Permission{},
		&model.UserGroup{},
		&model.ResourcePermission{},
		&model.AuditLog{},
		&model.Host{},
		&model.HostGroup{},
		&model.HostTag{},
		&model.AlertRule{},
		&model.AlertHistory{},
		&model.Application{},
		&model.Environment{},
		&model.Deployment{},
		&model.DeployScript{},
		&model.ConfigItem{},
		&model.ConfigHistory{},
		&model.Cluster{},
		&model.K8sYAMLHistory{},
		&model.AppVersion{},
		&model.Pipeline{},
		&model.PipelineStage{},
		&model.CloudAccount{},
		&model.CloudInstance{},
		&model.NodePool{},
		&model.PipelineDefinition{},
		&model.PipelineRun{},
		&model.StageRun{},
		&model.StepRun{},
		&model.Artifact{},
		&model.ApprovalRecord{},
	); err != nil {
		return nil, fmt.Errorf("failed to migrate database: %w", err)
	}

	return db, nil
}

func getEnvInt(key string, defaultVal int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return defaultVal
}
