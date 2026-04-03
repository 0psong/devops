package repository

import (
	"devops/internal/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type VersionRepository struct {
	db *gorm.DB
}

func NewVersionRepository(db *gorm.DB) *VersionRepository {
	return &VersionRepository{db: db}
}

func (r *VersionRepository) Create(version *model.AppVersion) error {
	return r.db.Create(version).Error
}

func (r *VersionRepository) GetByID(id uuid.UUID) (*model.AppVersion, error) {
	var version model.AppVersion
	err := r.db.Preload("App").First(&version, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &version, nil
}

func (r *VersionRepository) Update(version *model.AppVersion) error {
	return r.db.Save(version).Error
}

func (r *VersionRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&model.AppVersion{}, "id = ?", id).Error
}

func (r *VersionRepository) List(page, pageSize int, appID *uuid.UUID, keyword string) ([]model.AppVersion, int64, error) {
	var versions []model.AppVersion
	var total int64

	query := r.db.Model(&model.AppVersion{}).Preload("App")

	if appID != nil {
		query = query.Where("app_id = ?", *appID)
	}
	if keyword != "" {
		kw := LikeWrap(keyword)
		query = query.Where("version LIKE ? OR commit_msg LIKE ?", kw, kw)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&versions).Error; err != nil {
		return nil, 0, err
	}

	return versions, total, nil
}

func (r *VersionRepository) SetCurrentVersion(appID uuid.UUID, versionID uuid.UUID) error {
	// Unset all current for this app
	if err := r.db.Model(&model.AppVersion{}).Where("app_id = ? AND is_current = ?", appID, true).Update("is_current", false).Error; err != nil {
		return err
	}
	// Set the target as current
	return r.db.Model(&model.AppVersion{}).Where("id = ?", versionID).Update("is_current", true).Error
}

func (r *VersionRepository) IncrementDeployCount(id uuid.UUID) error {
	return r.db.Model(&model.AppVersion{}).Where("id = ?", id).UpdateColumn("deploy_count", gorm.Expr("deploy_count + 1")).Error
}
