package service

import (
	"errors"
	"fmt"

	"devops/internal/model"
	"devops/internal/pkg/cloud"
	"devops/internal/pkg/crypto"
	"devops/internal/repository"

	"github.com/google/uuid"
)

var (
	ErrCloudAccountNotFound  = errors.New("cloud account not found")
	ErrCloudInstanceNotFound = errors.New("cloud instance not found")
	ErrNodePoolNotFound      = errors.New("node pool not found")
	ErrInstanceBound         = errors.New("instance already bound to host")
	ErrInstanceNotBound      = errors.New("instance not bound to any host")
)

type CloudService struct {
	accountRepo  *repository.CloudAccountRepository
	instanceRepo *repository.CloudInstanceRepository
	nodePoolRepo *repository.NodePoolRepository
	hostRepo     *repository.HostRepository
	encryptor    *crypto.Encryptor
}

func NewCloudService(
	accountRepo *repository.CloudAccountRepository,
	instanceRepo *repository.CloudInstanceRepository,
	nodePoolRepo *repository.NodePoolRepository,
	hostRepo *repository.HostRepository,
	encryptKey string,
) *CloudService {
	return &CloudService{
		accountRepo:  accountRepo,
		instanceRepo: instanceRepo,
		nodePoolRepo: nodePoolRepo,
		hostRepo:     hostRepo,
		encryptor:    crypto.NewEncryptor(encryptKey),
	}
}

// --- 云账号管理 ---

type CreateAccountRequest struct {
	Name        string `json:"name" binding:"required"`
	Provider    string `json:"provider" binding:"required"` // alicloud, aws
	AccessKey   string `json:"access_key" binding:"required"`
	SecretKey   string `json:"secret_key" binding:"required"`
	Region      string `json:"region"`
	Description string `json:"description"`
}

type UpdateAccountRequest struct {
	Name        string `json:"name"`
	AccessKey   string `json:"access_key"`
	SecretKey   string `json:"secret_key"`
	Region      string `json:"region"`
	Description string `json:"description"`
}

func (s *CloudService) CreateAccount(req *CreateAccountRequest, createdBy uuid.UUID) (*model.CloudAccount, error) {
	encAK, err := s.encryptor.Encrypt(req.AccessKey)
	if err != nil {
		return nil, fmt.Errorf("encrypt access_key: %w", err)
	}
	encSK, err := s.encryptor.Encrypt(req.SecretKey)
	if err != nil {
		return nil, fmt.Errorf("encrypt secret_key: %w", err)
	}

	account := &model.CloudAccount{
		Name:        req.Name,
		Provider:    req.Provider,
		AccessKey:   encAK,
		SecretKey:   encSK,
		Region:      req.Region,
		Status:      1,
		Description: req.Description,
		CreatedBy:   createdBy,
	}

	if err := s.accountRepo.Create(account); err != nil {
		return nil, err
	}

	return s.accountRepo.GetByID(account.ID)
}

func (s *CloudService) GetAccount(id uuid.UUID) (*model.CloudAccount, error) {
	return s.accountRepo.GetByID(id)
}

func (s *CloudService) UpdateAccount(id uuid.UUID, req *UpdateAccountRequest) (*model.CloudAccount, error) {
	account, err := s.accountRepo.GetByID(id)
	if err != nil {
		return nil, ErrCloudAccountNotFound
	}

	if req.Name != "" {
		account.Name = req.Name
	}
	if req.AccessKey != "" {
		enc, err := s.encryptor.Encrypt(req.AccessKey)
		if err != nil {
			return nil, fmt.Errorf("encrypt access_key: %w", err)
		}
		account.AccessKey = enc
	}
	if req.SecretKey != "" {
		enc, err := s.encryptor.Encrypt(req.SecretKey)
		if err != nil {
			return nil, fmt.Errorf("encrypt secret_key: %w", err)
		}
		account.SecretKey = enc
	}
	if req.Region != "" {
		account.Region = req.Region
	}
	if req.Description != "" {
		account.Description = req.Description
	}

	if err := s.accountRepo.Update(account); err != nil {
		return nil, err
	}

	return s.accountRepo.GetByID(id)
}

func (s *CloudService) DeleteAccount(id uuid.UUID) error {
	if _, err := s.accountRepo.GetByID(id); err != nil {
		return ErrCloudAccountNotFound
	}
	return s.accountRepo.Delete(id)
}

func (s *CloudService) ListAccounts(page, pageSize int, provider, keyword string) ([]model.CloudAccount, int64, error) {
	return s.accountRepo.List(page, pageSize, provider, keyword)
}

func (s *CloudService) VerifyAccount(id uuid.UUID) error {
	account, err := s.accountRepo.GetByID(id)
	if err != nil {
		return ErrCloudAccountNotFound
	}

	ak, err := s.encryptor.Decrypt(account.AccessKey)
	if err != nil {
		return fmt.Errorf("decrypt access_key: %w", err)
	}
	sk, err := s.encryptor.Decrypt(account.SecretKey)
	if err != nil {
		return fmt.Errorf("decrypt secret_key: %w", err)
	}

	provider, err := cloud.NewProvider(account.Provider, ak, sk, account.Region)
	if err != nil {
		return err
	}

	if err := provider.ValidateCredentials(); err != nil {
		account.Status = 2
		s.accountRepo.Update(account)
		return fmt.Errorf("credential validation failed: %w", err)
	}

	account.Status = 1
	return s.accountRepo.Update(account)
}

// --- 云资源查询 ---

func (s *CloudService) getProvider(accountID uuid.UUID) (cloud.CloudProvider, error) {
	account, err := s.accountRepo.GetByID(accountID)
	if err != nil {
		return nil, ErrCloudAccountNotFound
	}

	ak, err := s.encryptor.Decrypt(account.AccessKey)
	if err != nil {
		return nil, fmt.Errorf("decrypt access_key: %w", err)
	}
	sk, err := s.encryptor.Decrypt(account.SecretKey)
	if err != nil {
		return nil, fmt.Errorf("decrypt secret_key: %w", err)
	}

	return cloud.NewProvider(account.Provider, ak, sk, account.Region)
}

func (s *CloudService) ListRegions(accountID uuid.UUID) ([]cloud.Region, error) {
	provider, err := s.getProvider(accountID)
	if err != nil {
		return nil, err
	}
	return provider.ListRegions()
}

func (s *CloudService) ListZones(accountID uuid.UUID, region string) ([]cloud.Zone, error) {
	provider, err := s.getProvider(accountID)
	if err != nil {
		return nil, err
	}
	return provider.ListZones(region)
}

func (s *CloudService) ListInstanceTypes(accountID uuid.UUID, region string) ([]cloud.InstanceTypeInfo, error) {
	provider, err := s.getProvider(accountID)
	if err != nil {
		return nil, err
	}
	return provider.ListInstanceTypes(region)
}

func (s *CloudService) ListImages(accountID uuid.UUID, region string) ([]cloud.Image, error) {
	provider, err := s.getProvider(accountID)
	if err != nil {
		return nil, err
	}
	return provider.ListImages(region)
}

// --- 云实例管理 ---

type CreateInstanceReq struct {
	AccountID    uuid.UUID `json:"account_id" binding:"required"`
	Name         string    `json:"name" binding:"required"`
	Region       string    `json:"region" binding:"required"`
	Zone         string    `json:"zone"`
	InstanceType string    `json:"instance_type" binding:"required"`
	ImageID      string    `json:"image_id" binding:"required"`
	ChargeType   string    `json:"charge_type"`
}

func (s *CloudService) CreateInstance(req *CreateInstanceReq, createdBy uuid.UUID) (*model.CloudInstance, error) {
	account, err := s.accountRepo.GetByID(req.AccountID)
	if err != nil {
		return nil, ErrCloudAccountNotFound
	}

	// 查找规格信息
	provider, err := s.getProvider(req.AccountID)
	if err != nil {
		return nil, err
	}

	instanceTypes, err := provider.ListInstanceTypes(req.Region)
	if err != nil {
		return nil, err
	}

	var cpu, mem int
	for _, it := range instanceTypes {
		if it.ID == req.InstanceType {
			cpu = it.CPU
			mem = it.Memory
			break
		}
	}

	chargeType := req.ChargeType
	if chargeType == "" {
		chargeType = "PostPaid"
	}

	instance := &model.CloudInstance{
		AccountID:    req.AccountID,
		Name:         req.Name,
		Provider:     account.Provider,
		Region:       req.Region,
		Zone:         req.Zone,
		InstanceType: req.InstanceType,
		ImageID:      req.ImageID,
		CPU:          cpu,
		Memory:       mem,
		Status:       "pending",
		ChargeType:   chargeType,
		CreatedBy:    createdBy,
	}

	if err := s.instanceRepo.Create(instance); err != nil {
		return nil, err
	}

	// 尝试通过云API创建实例
	cloudReq := cloud.CreateInstanceRequest{
		Name:         req.Name,
		Region:       req.Region,
		Zone:         req.Zone,
		InstanceType: req.InstanceType,
		ImageID:      req.ImageID,
		ChargeType:   chargeType,
	}

	result, err := provider.CreateInstance(cloudReq)
	if err != nil {
		// 云API调用失败，标记状态但保留记录
		instance.Status = "create_failed"
		s.instanceRepo.Update(instance)
		return s.instanceRepo.GetByID(instance.ID)
	}

	// 更新实例信息
	instance.InstanceID = result.InstanceID
	instance.PublicIP = result.PublicIP
	instance.PrivateIP = result.PrivateIP
	instance.Status = result.Status
	s.instanceRepo.Update(instance)

	return s.instanceRepo.GetByID(instance.ID)
}

func (s *CloudService) GetInstance(id uuid.UUID) (*model.CloudInstance, error) {
	return s.instanceRepo.GetByID(id)
}

func (s *CloudService) ListInstances(page, pageSize int, accountID *uuid.UUID, status string, clusterID *uuid.UUID) ([]model.CloudInstance, int64, error) {
	return s.instanceRepo.List(page, pageSize, accountID, status, clusterID)
}

func (s *CloudService) StartInstance(id uuid.UUID) (*model.CloudInstance, error) {
	instance, err := s.instanceRepo.GetByID(id)
	if err != nil {
		return nil, ErrCloudInstanceNotFound
	}

	if instance.InstanceID != "" {
		provider, err := s.getProvider(instance.AccountID)
		if err == nil {
			provider.StartInstance(instance.InstanceID)
		}
	}

	instance.Status = "running"
	s.instanceRepo.Update(instance)
	return s.instanceRepo.GetByID(id)
}

func (s *CloudService) StopInstance(id uuid.UUID) (*model.CloudInstance, error) {
	instance, err := s.instanceRepo.GetByID(id)
	if err != nil {
		return nil, ErrCloudInstanceNotFound
	}

	if instance.InstanceID != "" {
		provider, err := s.getProvider(instance.AccountID)
		if err == nil {
			provider.StopInstance(instance.InstanceID)
		}
	}

	instance.Status = "stopped"
	s.instanceRepo.Update(instance)
	return s.instanceRepo.GetByID(id)
}

func (s *CloudService) TerminateInstance(id uuid.UUID) (*model.CloudInstance, error) {
	instance, err := s.instanceRepo.GetByID(id)
	if err != nil {
		return nil, ErrCloudInstanceNotFound
	}

	if instance.InstanceID != "" {
		provider, err := s.getProvider(instance.AccountID)
		if err == nil {
			provider.TerminateInstance(instance.InstanceID)
		}
	}

	instance.Status = "terminated"
	s.instanceRepo.Update(instance)
	return s.instanceRepo.GetByID(id)
}

func (s *CloudService) SyncInstance(id uuid.UUID) (*model.CloudInstance, error) {
	instance, err := s.instanceRepo.GetByID(id)
	if err != nil {
		return nil, ErrCloudInstanceNotFound
	}

	if instance.InstanceID != "" {
		provider, err := s.getProvider(instance.AccountID)
		if err == nil {
			status, err := provider.GetInstanceStatus(instance.InstanceID)
			if err == nil {
				instance.Status = status
				s.instanceRepo.Update(instance)
			}
		}
	}

	return s.instanceRepo.GetByID(id)
}

// BindHost 上架：将云实例关联到 CMDB Host
func (s *CloudService) BindHost(id uuid.UUID) (*model.CloudInstance, error) {
	instance, err := s.instanceRepo.GetByID(id)
	if err != nil {
		return nil, ErrCloudInstanceNotFound
	}

	if instance.HostID != nil {
		return nil, ErrInstanceBound
	}

	ip := instance.PrivateIP
	if ip == "" {
		ip = instance.PublicIP
	}
	if ip == "" {
		return nil, fmt.Errorf("instance has no IP address")
	}

	host := &model.Host{
		Name:     instance.Name,
		Hostname: instance.Name,
		IP:       ip,
		Port:     22,
		OS:       "Linux",
		Status:   1,
	}

	if err := s.hostRepo.Create(host); err != nil {
		return nil, fmt.Errorf("create host: %w", err)
	}

	instance.HostID = &host.ID
	if err := s.instanceRepo.Update(instance); err != nil {
		return nil, err
	}

	return s.instanceRepo.GetByID(id)
}

// UnbindHost 下架：解除云实例与 CMDB Host 的关联
func (s *CloudService) UnbindHost(id uuid.UUID) (*model.CloudInstance, error) {
	instance, err := s.instanceRepo.GetByID(id)
	if err != nil {
		return nil, ErrCloudInstanceNotFound
	}

	if instance.HostID == nil {
		return nil, ErrInstanceNotBound
	}

	instance.HostID = nil
	if err := s.instanceRepo.Update(instance); err != nil {
		return nil, err
	}

	return s.instanceRepo.GetByID(id)
}

// --- 节点池管理 ---

type CreateNodePoolRequest struct {
	ClusterID    uuid.UUID `json:"cluster_id" binding:"required"`
	AccountID    uuid.UUID `json:"account_id" binding:"required"`
	Name         string    `json:"name" binding:"required"`
	InstanceType string    `json:"instance_type"`
	ImageID      string    `json:"image_id"`
	MinSize      int       `json:"min_size"`
	MaxSize      int       `json:"max_size"`
	DesiredSize  int       `json:"desired_size"`
	Description  string    `json:"description"`
}

type UpdateNodePoolRequest struct {
	Name        string `json:"name"`
	MinSize     *int   `json:"min_size"`
	MaxSize     *int   `json:"max_size"`
	DesiredSize *int   `json:"desired_size"`
	Description string `json:"description"`
}

type ScaleNodePoolRequest struct {
	DesiredSize int `json:"desired_size" binding:"required"`
}

func (s *CloudService) CreateNodePool(req *CreateNodePoolRequest, createdBy uuid.UUID) (*model.NodePool, error) {
	maxSize := req.MaxSize
	if maxSize <= 0 {
		maxSize = 10
	}

	pool := &model.NodePool{
		ClusterID:    req.ClusterID,
		AccountID:    req.AccountID,
		Name:         req.Name,
		InstanceType: req.InstanceType,
		ImageID:      req.ImageID,
		MinSize:      req.MinSize,
		MaxSize:      maxSize,
		DesiredSize:  req.DesiredSize,
		CurrentSize:  0,
		Status:       "active",
		Description:  req.Description,
		CreatedBy:    createdBy,
	}

	if err := s.nodePoolRepo.Create(pool); err != nil {
		return nil, err
	}

	return s.nodePoolRepo.GetByID(pool.ID)
}

func (s *CloudService) GetNodePool(id uuid.UUID) (*model.NodePool, error) {
	return s.nodePoolRepo.GetByID(id)
}

func (s *CloudService) UpdateNodePool(id uuid.UUID, req *UpdateNodePoolRequest) (*model.NodePool, error) {
	pool, err := s.nodePoolRepo.GetByID(id)
	if err != nil {
		return nil, ErrNodePoolNotFound
	}

	if req.Name != "" {
		pool.Name = req.Name
	}
	if req.MinSize != nil {
		pool.MinSize = *req.MinSize
	}
	if req.MaxSize != nil {
		pool.MaxSize = *req.MaxSize
	}
	if req.DesiredSize != nil {
		pool.DesiredSize = *req.DesiredSize
	}
	if req.Description != "" {
		pool.Description = req.Description
	}

	if err := s.nodePoolRepo.Update(pool); err != nil {
		return nil, err
	}

	return s.nodePoolRepo.GetByID(id)
}

func (s *CloudService) DeleteNodePool(id uuid.UUID) error {
	if _, err := s.nodePoolRepo.GetByID(id); err != nil {
		return ErrNodePoolNotFound
	}
	return s.nodePoolRepo.Delete(id)
}

func (s *CloudService) ListNodePools(page, pageSize int, clusterID *uuid.UUID) ([]model.NodePool, int64, error) {
	return s.nodePoolRepo.List(page, pageSize, clusterID)
}

func (s *CloudService) ScaleNodePool(id uuid.UUID, req *ScaleNodePoolRequest) (*model.NodePool, error) {
	pool, err := s.nodePoolRepo.GetByID(id)
	if err != nil {
		return nil, ErrNodePoolNotFound
	}

	if req.DesiredSize < pool.MinSize || req.DesiredSize > pool.MaxSize {
		return nil, fmt.Errorf("desired_size must be between %d and %d", pool.MinSize, pool.MaxSize)
	}

	pool.DesiredSize = req.DesiredSize
	pool.Status = "scaling"

	if err := s.nodePoolRepo.Update(pool); err != nil {
		return nil, err
	}

	return s.nodePoolRepo.GetByID(id)
}
