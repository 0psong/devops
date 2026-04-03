package repository

import (
	"devops/internal/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type PipelineRepository struct {
	db *gorm.DB
}

func NewPipelineRepository(db *gorm.DB) *PipelineRepository {
	return &PipelineRepository{db: db}
}

func (r *PipelineRepository) Create(pipeline *model.Pipeline) error {
	return r.db.Create(pipeline).Error
}

func (r *PipelineRepository) GetByID(id uuid.UUID) (*model.Pipeline, error) {
	var pipeline model.Pipeline
	err := r.db.Preload("App").Preload("Stages", func(db *gorm.DB) *gorm.DB {
		return db.Order("sort ASC")
	}).First(&pipeline, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &pipeline, nil
}

func (r *PipelineRepository) Update(pipeline *model.Pipeline) error {
	return r.db.Save(pipeline).Error
}

func (r *PipelineRepository) Delete(id uuid.UUID) error {
	// Delete stages first
	r.db.Where("pipeline_id = ?", id).Delete(&model.PipelineStage{})
	return r.db.Delete(&model.Pipeline{}, "id = ?", id).Error
}

func (r *PipelineRepository) List(page, pageSize int, appID *uuid.UUID, status string) ([]model.Pipeline, int64, error) {
	var pipelines []model.Pipeline
	var total int64

	query := r.db.Model(&model.Pipeline{}).Preload("App").Preload("Stages", func(db *gorm.DB) *gorm.DB {
		return db.Order("sort ASC")
	})

	if appID != nil {
		query = query.Where("app_id = ?", *appID)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&pipelines).Error; err != nil {
		return nil, 0, err
	}

	return pipelines, total, nil
}

func (r *PipelineRepository) UpdateStage(stage *model.PipelineStage) error {
	return r.db.Save(stage).Error
}
