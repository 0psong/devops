package repository

import (
	"devops/internal/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// PipelineDefinitionRepository
type PipelineDefinitionRepository struct {
	db *gorm.DB
}

func NewPipelineDefinitionRepository(db *gorm.DB) *PipelineDefinitionRepository {
	return &PipelineDefinitionRepository{db: db}
}

func (r *PipelineDefinitionRepository) Create(def *model.PipelineDefinition) error {
	return r.db.Create(def).Error
}

func (r *PipelineDefinitionRepository) GetByID(id uuid.UUID) (*model.PipelineDefinition, error) {
	var def model.PipelineDefinition
	err := r.db.Preload("App").First(&def, "id = ?", id).Error
	return &def, err
}

func (r *PipelineDefinitionRepository) Update(def *model.PipelineDefinition) error {
	return r.db.Save(def).Error
}

func (r *PipelineDefinitionRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&model.PipelineDefinition{}, "id = ?", id).Error
}

func (r *PipelineDefinitionRepository) List(page, pageSize int, appID *uuid.UUID, keyword string) ([]model.PipelineDefinition, int64, error) {
	var defs []model.PipelineDefinition
	var total int64

	query := r.db.Model(&model.PipelineDefinition{}).Preload("App")
	if appID != nil {
		query = query.Where("app_id = ?", *appID)
	}
	if keyword != "" {
		kw := LikeWrap(keyword)
		query = query.Where("name LIKE ? OR description LIKE ?", kw, kw)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&defs).Error; err != nil {
		return nil, 0, err
	}

	return defs, total, nil
}

// PipelineRunRepository
type PipelineRunRepository struct {
	db *gorm.DB
}

func NewPipelineRunRepository(db *gorm.DB) *PipelineRunRepository {
	return &PipelineRunRepository{db: db}
}

func (r *PipelineRunRepository) Create(run *model.PipelineRun) error {
	return r.db.Create(run).Error
}

func (r *PipelineRunRepository) GetByID(id uuid.UUID) (*model.PipelineRun, error) {
	var run model.PipelineRun
	err := r.db.Preload("Definition").Preload("Definition.App").
		Preload("Stages", func(db *gorm.DB) *gorm.DB {
			return db.Order("sort ASC")
		}).
		Preload("Stages.Steps", func(db *gorm.DB) *gorm.DB {
			return db.Order("sort ASC")
		}).
		First(&run, "id = ?", id).Error
	return &run, err
}

func (r *PipelineRunRepository) Update(run *model.PipelineRun) error {
	return r.db.Save(run).Error
}

func (r *PipelineRunRepository) List(page, pageSize int, definitionID *uuid.UUID, status string) ([]model.PipelineRun, int64, error) {
	var runs []model.PipelineRun
	var total int64

	query := r.db.Model(&model.PipelineRun{}).Preload("Definition").Preload("Definition.App")
	if definitionID != nil {
		query = query.Where("definition_id = ?", *definitionID)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&runs).Error; err != nil {
		return nil, 0, err
	}

	return runs, total, nil
}

func (r *PipelineRunRepository) GetNextRunNumber(definitionID uuid.UUID) (int, error) {
	var maxNum int
	err := r.db.Model(&model.PipelineRun{}).Where("definition_id = ?", definitionID).
		Select("COALESCE(MAX(run_number), 0)").Scan(&maxNum).Error
	return maxNum + 1, err
}

// StageRunRepository
type StageRunRepository struct {
	db *gorm.DB
}

func NewStageRunRepository(db *gorm.DB) *StageRunRepository {
	return &StageRunRepository{db: db}
}

func (r *StageRunRepository) Create(stage *model.StageRun) error {
	return r.db.Create(stage).Error
}

func (r *StageRunRepository) Update(stage *model.StageRun) error {
	return r.db.Save(stage).Error
}

func (r *StageRunRepository) ListByRunID(runID uuid.UUID) ([]model.StageRun, error) {
	var stages []model.StageRun
	err := r.db.Preload("Steps", func(db *gorm.DB) *gorm.DB {
		return db.Order("sort ASC")
	}).Where("pipeline_run_id = ?", runID).Order("sort ASC").Find(&stages).Error
	return stages, err
}

func (r *StageRunRepository) FindWaitingApproval(runID uuid.UUID) (*model.StageRun, error) {
	var stage model.StageRun
	err := r.db.Where("pipeline_run_id = ? AND type = ? AND status = ?", runID, "approval", "waiting_approval").First(&stage).Error
	return &stage, err
}

// StepRunRepository
type StepRunRepository struct {
	db *gorm.DB
}

func NewStepRunRepository(db *gorm.DB) *StepRunRepository {
	return &StepRunRepository{db: db}
}

func (r *StepRunRepository) Create(step *model.StepRun) error {
	return r.db.Create(step).Error
}

func (r *StepRunRepository) GetByID(id uuid.UUID) (*model.StepRun, error) {
	var step model.StepRun
	err := r.db.First(&step, "id = ?", id).Error
	return &step, err
}

func (r *StepRunRepository) Update(step *model.StepRun) error {
	return r.db.Save(step).Error
}

// ArtifactRepository
type ArtifactRepository struct {
	db *gorm.DB
}

func NewArtifactRepository(db *gorm.DB) *ArtifactRepository {
	return &ArtifactRepository{db: db}
}

func (r *ArtifactRepository) Create(artifact *model.Artifact) error {
	return r.db.Create(artifact).Error
}

func (r *ArtifactRepository) GetByID(id uuid.UUID) (*model.Artifact, error) {
	var artifact model.Artifact
	err := r.db.Preload("App").First(&artifact, "id = ?", id).Error
	return &artifact, err
}

func (r *ArtifactRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&model.Artifact{}, "id = ?", id).Error
}

func (r *ArtifactRepository) List(page, pageSize int, appID *uuid.UUID, pipelineRunID *uuid.UUID) ([]model.Artifact, int64, error) {
	var artifacts []model.Artifact
	var total int64

	query := r.db.Model(&model.Artifact{}).Preload("App")
	if appID != nil {
		query = query.Where("app_id = ?", *appID)
	}
	if pipelineRunID != nil {
		query = query.Where("pipeline_run_id = ?", *pipelineRunID)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&artifacts).Error; err != nil {
		return nil, 0, err
	}

	return artifacts, total, nil
}

// ApprovalRepository
type ApprovalRepository struct {
	db *gorm.DB
}

func NewApprovalRepository(db *gorm.DB) *ApprovalRepository {
	return &ApprovalRepository{db: db}
}

func (r *ApprovalRepository) Create(record *model.ApprovalRecord) error {
	return r.db.Create(record).Error
}

func (r *ApprovalRepository) ListPending(page, pageSize int) ([]model.PipelineRun, int64, error) {
	var runs []model.PipelineRun
	var total int64

	query := r.db.Model(&model.PipelineRun{}).Where("status = ?", "waiting_approval")

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Preload("Definition").Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&runs).Error; err != nil {
		return nil, 0, err
	}

	return runs, total, nil
}
