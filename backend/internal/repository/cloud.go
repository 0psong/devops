package repository

import (
	"devops/internal/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// CloudAccountRepository
type CloudAccountRepository struct {
	db *gorm.DB
}

func NewCloudAccountRepository(db *gorm.DB) *CloudAccountRepository {
	return &CloudAccountRepository{db: db}
}

func (r *CloudAccountRepository) Create(account *model.CloudAccount) error {
	return r.db.Create(account).Error
}

func (r *CloudAccountRepository) GetByID(id uuid.UUID) (*model.CloudAccount, error) {
	var account model.CloudAccount
	err := r.db.First(&account, "id = ?", id).Error
	return &account, err
}

func (r *CloudAccountRepository) Update(account *model.CloudAccount) error {
	return r.db.Save(account).Error
}

func (r *CloudAccountRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&model.CloudAccount{}, "id = ?", id).Error
}

func (r *CloudAccountRepository) List(page, pageSize int, provider, keyword string) ([]model.CloudAccount, int64, error) {
	var accounts []model.CloudAccount
	var total int64

	query := r.db.Model(&model.CloudAccount{})
	if provider != "" {
		query = query.Where("provider = ?", provider)
	}
	if keyword != "" {
		kw := LikeWrap(keyword)
		query = query.Where("name LIKE ? OR description LIKE ?", kw, kw)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&accounts).Error; err != nil {
		return nil, 0, err
	}

	return accounts, total, nil
}

// CloudInstanceRepository
type CloudInstanceRepository struct {
	db *gorm.DB
}

func NewCloudInstanceRepository(db *gorm.DB) *CloudInstanceRepository {
	return &CloudInstanceRepository{db: db}
}

func (r *CloudInstanceRepository) Create(instance *model.CloudInstance) error {
	return r.db.Create(instance).Error
}

func (r *CloudInstanceRepository) GetByID(id uuid.UUID) (*model.CloudInstance, error) {
	var instance model.CloudInstance
	err := r.db.Preload("Account").Preload("Host").First(&instance, "id = ?", id).Error
	return &instance, err
}

func (r *CloudInstanceRepository) Update(instance *model.CloudInstance) error {
	return r.db.Save(instance).Error
}

func (r *CloudInstanceRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&model.CloudInstance{}, "id = ?", id).Error
}

func (r *CloudInstanceRepository) List(page, pageSize int, accountID *uuid.UUID, status string, clusterID *uuid.UUID) ([]model.CloudInstance, int64, error) {
	var instances []model.CloudInstance
	var total int64

	query := r.db.Model(&model.CloudInstance{}).Preload("Account").Preload("Host")
	if accountID != nil {
		query = query.Where("account_id = ?", *accountID)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if clusterID != nil {
		query = query.Where("cluster_id = ?", *clusterID)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&instances).Error; err != nil {
		return nil, 0, err
	}

	return instances, total, nil
}

// NodePoolRepository
type NodePoolRepository struct {
	db *gorm.DB
}

func NewNodePoolRepository(db *gorm.DB) *NodePoolRepository {
	return &NodePoolRepository{db: db}
}

func (r *NodePoolRepository) Create(pool *model.NodePool) error {
	return r.db.Create(pool).Error
}

func (r *NodePoolRepository) GetByID(id uuid.UUID) (*model.NodePool, error) {
	var pool model.NodePool
	err := r.db.Preload("Cluster").Preload("Account").First(&pool, "id = ?", id).Error
	return &pool, err
}

func (r *NodePoolRepository) Update(pool *model.NodePool) error {
	return r.db.Save(pool).Error
}

func (r *NodePoolRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&model.NodePool{}, "id = ?", id).Error
}

func (r *NodePoolRepository) List(page, pageSize int, clusterID *uuid.UUID) ([]model.NodePool, int64, error) {
	var pools []model.NodePool
	var total int64

	query := r.db.Model(&model.NodePool{}).Preload("Cluster").Preload("Account")
	if clusterID != nil {
		query = query.Where("cluster_id = ?", *clusterID)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&pools).Error; err != nil {
		return nil, 0, err
	}

	return pools, total, nil
}
