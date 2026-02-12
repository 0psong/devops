package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"devops/internal/config"
	auditHandler "devops/internal/handler/audit"
	authHandler "devops/internal/handler/auth"
	cloudHandler "devops/internal/handler/cloud"
	configHandler "devops/internal/handler/config"
	dashboardHandler "devops/internal/handler/dashboard"
	deployHandler "devops/internal/handler/deploy"
	groupHandler "devops/internal/handler/group"
	k8sHandler "devops/internal/handler/k8s"
	monitorHandler "devops/internal/handler/monitor"
	pipelineHandler "devops/internal/handler/pipeline"
	pipelineV2Handler "devops/internal/handler/pipeline_v2"
	userHandler "devops/internal/handler/user"
	versionHandler "devops/internal/handler/version"
	"devops/internal/middleware"
	"devops/internal/model"
	"devops/internal/pkg/jwt"
	"devops/internal/repository"
	"devops/internal/service"

	"github.com/gin-gonic/gin"
)

func main() {
	// Load config
	cfg, err := config.Load("config.yaml")
	if err != nil {
		log.Printf("Failed to load config file, using defaults: %v", err)
		cfg = config.LoadDefault()
	}

	// Initialize database
	db, err := repository.InitDatabase(&cfg.Database)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	// Initialize JWT manager
	jwtManager := jwt.NewJWTManager(cfg.JWT.Secret, cfg.JWT.ExpireHour)

	// Initialize repositories
	userRepo := repository.NewUserRepository(db)
	roleRepo := repository.NewRoleRepository(db)
	permRepo := repository.NewPermissionRepository(db)
	groupRepo := repository.NewUserGroupRepository(db)
	auditRepo := repository.NewAuditRepository(db)
	hostRepo := repository.NewHostRepository(db)
	hostGroupRepo := repository.NewHostGroupRepository(db)
	hostTagRepo := repository.NewHostTagRepository(db)
	appRepo := repository.NewAppRepository(db)
	envRepo := repository.NewEnvRepository(db)
	deployRepo := repository.NewDeploymentRepository(db)
	configRepo := repository.NewConfigRepository(db)
	configHistoryRepo := repository.NewConfigHistoryRepository(db)
	clusterRepo := repository.NewClusterRepository(db)
	k8sHistoryRepo := repository.NewK8sYAMLHistoryRepository(db)
	versionRepo := repository.NewVersionRepository(db)
	pipelineRepo := repository.NewPipelineRepository(db)
	cloudAccountRepo := repository.NewCloudAccountRepository(db)
	cloudInstanceRepo := repository.NewCloudInstanceRepository(db)
	nodePoolRepo := repository.NewNodePoolRepository(db)
	pipelineDefRepo := repository.NewPipelineDefinitionRepository(db)
	pipelineRunRepo := repository.NewPipelineRunRepository(db)
	stageRunRepo := repository.NewStageRunRepository(db)
	stepRunRepo := repository.NewStepRunRepository(db)
	artifactRepo := repository.NewArtifactRepository(db)
	approvalRepo := repository.NewApprovalRepository(db)

	// Initialize default data
	if err := roleRepo.InitDefaultRoles(); err != nil {
		log.Printf("Failed to init default roles: %v", err)
	}
	if err := envRepo.InitDefaultEnvs(); err != nil {
		log.Printf("Failed to init default environments: %v", err)
	}

	// Initialize services
	authService := service.NewAuthService(userRepo, roleRepo, jwtManager)
	userService := service.NewUserService(userRepo, roleRepo)
	roleService := service.NewRoleService(roleRepo, permRepo)
	groupService := service.NewGroupService(groupRepo)
	auditService := service.NewAuditService(auditRepo)
	hostService := service.NewHostService(hostRepo, hostGroupRepo, hostTagRepo)
	hostGroupService := service.NewHostGroupService(hostGroupRepo)
	hostTagService := service.NewHostTagService(hostTagRepo)
	appService := service.NewAppService(appRepo, envRepo, deployRepo, hostRepo)
	deployService := service.NewDeploymentService(deployRepo, appRepo)
	envService := service.NewEnvService(envRepo)
	configService := service.NewConfigService(configRepo, configHistoryRepo, cfg.JWT.Secret)
	k8sService := service.NewK8sService(clusterRepo, k8sHistoryRepo, cfg.JWT.Secret)
	dashboardSvc := service.NewDashboardService(db)
	versionService := service.NewVersionService(versionRepo, appRepo)
	pipelineService := service.NewPipelineService(pipelineRepo, appRepo)
	cloudService := service.NewCloudService(cloudAccountRepo, cloudInstanceRepo, nodePoolRepo, hostRepo, cfg.JWT.Secret)
	pipelineV2Service := service.NewPipelineV2Service(pipelineDefRepo, pipelineRunRepo, stageRunRepo, stepRunRepo, artifactRepo, approvalRepo, appRepo)

	// Initialize admin user
	if err := authService.InitAdminUser(); err != nil {
		log.Printf("Failed to init admin user: %v", err)
	}

	// Initialize default permissions
	if err := initDefaultPermissions(permRepo, roleRepo); err != nil {
		log.Printf("Failed to init default permissions: %v", err)
	}

	// Initialize handlers
	authH := authHandler.NewHandler(authService)
	userH := userHandler.NewHandler(userService, roleService)
	groupH := groupHandler.NewHandler(groupService)
	auditH := auditHandler.NewHandler(auditService)
	monitorH := monitorHandler.NewHandler(hostService, hostGroupService, hostTagService)
	deployH := deployHandler.NewHandler(appService, deployService, envService)
	configH := configHandler.NewHandler(configService)
	k8sH := k8sHandler.NewHandler(k8sService)
	dashboardH := dashboardHandler.NewHandler(dashboardSvc)
	versionH := versionHandler.NewHandler(versionService)
	pipelineH := pipelineHandler.NewHandler(pipelineService)
	cloudH := cloudHandler.NewHandler(cloudService)
	pipelineV2H := pipelineV2Handler.NewHandler(pipelineV2Service)

	// Setup Gin
	if cfg.Server.Mode == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.Default()

	// Middleware
	r.Use(middleware.CORS())
	r.Use(middleware.SecurityHeaders())

	// Health check with database verification
	r.GET("/health", func(c *gin.Context) {
		sqlDB, err := db.DB()
		if err != nil {
			c.JSON(503, gin.H{"status": "error", "message": "database unavailable"})
			return
		}
		if err := sqlDB.Ping(); err != nil {
			c.JSON(503, gin.H{"status": "error", "message": "database ping failed"})
			return
		}
		c.JSON(200, gin.H{"status": "ok"})
	})

	// API routes
	api := r.Group("/api/v1")
	{
		// Public routes (with rate limiting to prevent brute force)
		auth := api.Group("/auth")
		auth.Use(middleware.RateLimit(10, time.Minute)) // 10 requests per minute per IP
		authH.RegisterRoutes(auth)

		// Protected routes
		protected := api.Group("")
		protected.Use(middleware.JWTAuth(jwtManager))
		protected.Use(middleware.AuditLog(db))

		// Auth routes (protected)
		authProtected := protected.Group("/auth")
		authH.RegisterAuthRoutes(authProtected)

		// User and Role routes
		userH.RegisterRoutes(protected)

		// User Group routes
		groupH.RegisterRoutes(protected)

		// Audit log routes
		auditH.RegisterRoutes(protected)

		// Monitor routes (with permission check)
		monitorH.RegisterRoutes(protected)

		// Deploy routes (with permission check)
		deployH.RegisterRoutes(protected)

		// Config routes (with permission check)
		configH.RegisterRoutes(protected)

		// K8s cluster routes (with permission check)
		k8sH.RegisterRoutes(protected)

		// Dashboard routes
		dashboardH.RegisterRoutes(protected)

		// Version routes
		versionH.RegisterRoutes(protected)

		// Pipeline routes
		pipelineH.RegisterRoutes(protected)

		// Cloud resource management routes
		cloudH.RegisterRoutes(protected)

		// Pipeline V2 (advanced) routes
		pipelineV2H.RegisterRoutes(protected)
	}

	// Start server with graceful shutdown and security timeouts
	addr := fmt.Sprintf(":%s", cfg.Server.Port)
	srv := &http.Server{
		Addr:              addr,
		Handler:           r,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
		ReadHeaderTimeout: 10 * time.Second,
		MaxHeaderBytes:    1 << 20, // 1MB
	}

	go func() {
		log.Printf("Server starting on %s", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}
	log.Println("Server exited")
}

// initDefaultPermissions 初始化默认权限
func initDefaultPermissions(permRepo *repository.PermissionRepository, roleRepo *repository.RoleRepository) error {
	permissions := []struct {
		Name     string
		Code     string
		Type     string
		Resource string
		Action   string
	}{
		// 用户管理
		{"查看用户", "user:view", "api", "user", "view"},
		{"创建用户", "user:create", "api", "user", "create"},
		{"更新用户", "user:update", "api", "user", "update"},
		{"删除用户", "user:delete", "api", "user", "delete"},
		// 角色管理
		{"查看角色", "role:view", "api", "role", "view"},
		{"创建角色", "role:create", "api", "role", "create"},
		{"更新角色", "role:update", "api", "role", "update"},
		{"删除角色", "role:delete", "api", "role", "delete"},
		// 分组管理
		{"查看分组", "group:view", "api", "group", "view"},
		{"创建分组", "group:create", "api", "group", "create"},
		{"更新分组", "group:update", "api", "group", "update"},
		{"删除分组", "group:delete", "api", "group", "delete"},
		// 主机管理
		{"查看主机", "host:view", "api", "host", "view"},
		{"创建主机", "host:create", "api", "host", "create"},
		{"更新主机", "host:update", "api", "host", "update"},
		{"删除主机", "host:delete", "api", "host", "delete"},
		{"连接主机", "host:connect", "api", "host", "execute"},
		// 应用管理
		{"查看应用", "app:view", "api", "app", "view"},
		{"创建应用", "app:create", "api", "app", "create"},
		{"更新应用", "app:update", "api", "app", "update"},
		{"删除应用", "app:delete", "api", "app", "delete"},
		// 部署管理
		{"查看部署", "deploy:view", "api", "deploy", "view"},
		{"创建部署", "deploy:create", "api", "deploy", "create"},
		{"执行部署", "deploy:execute", "api", "deploy", "execute"},
		{"回滚部署", "deploy:rollback", "api", "deploy", "execute"},
		// 配置管理
		{"查看配置", "config:view", "api", "config", "view"},
		{"创建配置", "config:create", "api", "config", "create"},
		{"更新配置", "config:update", "api", "config", "update"},
		{"删除配置", "config:delete", "api", "config", "delete"},
		// K8s管理
		{"查看集群", "cluster:view", "api", "cluster", "view"},
		{"创建集群", "cluster:create", "api", "cluster", "create"},
		{"更新集群", "cluster:update", "api", "cluster", "update"},
		{"删除集群", "cluster:delete", "api", "cluster", "delete"},
		{"应用YAML", "k8s:apply-yaml", "api", "cluster", "execute"},
		// 审计日志
		{"查看审计", "audit:view", "api", "audit", "view"},
		{"导出审计", "audit:export", "api", "audit", "execute"},
		// 云资源管理
		{"查看云资源", "cloud:view", "api", "cloud", "view"},
		{"创建云资源", "cloud:create", "api", "cloud", "create"},
		{"更新云资源", "cloud:update", "api", "cloud", "update"},
		{"删除云资源", "cloud:delete", "api", "cloud", "delete"},
		{"操作云资源", "cloud:operate", "api", "cloud", "execute"},
		// 高级流水线
		{"查看流水线定义", "pipeline-def:view", "api", "pipeline-def", "view"},
		{"创建流水线定义", "pipeline-def:create", "api", "pipeline-def", "create"},
		{"更新流水线定义", "pipeline-def:update", "api", "pipeline-def", "update"},
		{"删除流水线定义", "pipeline-def:delete", "api", "pipeline-def", "delete"},
		{"查看流水线运行", "pipeline-run:view", "api", "pipeline-run", "view"},
		{"触发流水线运行", "pipeline-run:trigger", "api", "pipeline-run", "execute"},
		{"取消流水线运行", "pipeline-run:cancel", "api", "pipeline-run", "execute"},
		// 审批
		{"查看审批", "approval:view", "api", "approval", "view"},
		{"操作审批", "approval:operate", "api", "approval", "execute"},
		// 制品
		{"查看制品", "artifact:view", "api", "artifact", "view"},
		{"删除制品", "artifact:delete", "api", "artifact", "delete"},
	}

	for _, p := range permissions {
		// 检查是否已存在
		if _, err := permRepo.GetByCode(p.Code); err == nil {
			continue
		}
		perm := &model.Permission{
			Name:     p.Name,
			Code:     p.Code,
			Type:     p.Type,
			Resource: p.Resource,
			Action:   p.Action,
			Status:   1,
		}
		if err := permRepo.Create(perm); err != nil {
			return err
		}
	}

	return nil
}
