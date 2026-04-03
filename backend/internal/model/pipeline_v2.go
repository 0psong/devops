package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// PipelineDefinition 流水线定义（模板）
type PipelineDefinition struct {
	ID            uuid.UUID      `json:"id" gorm:"type:uuid;primary_key"`
	Name          string         `json:"name" gorm:"size:100;not null"`
	AppID         uuid.UUID      `json:"app_id" gorm:"type:uuid;index;not null"`
	App           *Application   `json:"app,omitempty" gorm:"foreignKey:AppID"`
	Description   string         `json:"description" gorm:"size:500"`
	Config        string         `json:"config" gorm:"type:text"`
	EnvVars       string         `json:"env_vars" gorm:"type:text"`
	TriggerType   string         `json:"trigger_type" gorm:"size:20;default:'manual'"`
	TriggerConfig string         `json:"trigger_config" gorm:"type:text"`
	Enabled       bool           `json:"enabled" gorm:"default:true"`
	CreatedBy     uuid.UUID      `json:"created_by" gorm:"type:uuid"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `json:"-" gorm:"index"`
}

func (d *PipelineDefinition) BeforeCreate(tx *gorm.DB) error {
	if d.ID == uuid.Nil {
		d.ID = uuid.New()
	}
	return nil
}

// PipelineRun 流水线运行记录
type PipelineRun struct {
	ID           uuid.UUID           `json:"id" gorm:"type:uuid;primary_key"`
	DefinitionID uuid.UUID           `json:"definition_id" gorm:"type:uuid;index;not null"`
	Definition   *PipelineDefinition `json:"definition,omitempty" gorm:"foreignKey:DefinitionID"`
	RunNumber    int                 `json:"run_number" gorm:"not null"`
	Status       string              `json:"status" gorm:"size:20;default:'pending';index"` // pending, running, success, failed, cancelled, waiting_approval
	Branch       string              `json:"branch" gorm:"size:100"`
	CommitID     string              `json:"commit_id" gorm:"size:50"`
	CommitMsg    string              `json:"commit_msg" gorm:"size:500"`
	EnvVars      string              `json:"env_vars" gorm:"type:text"`
	Duration     int                 `json:"duration" gorm:"default:0"`
	TriggerType  string              `json:"trigger_type" gorm:"size:20"`
	TriggerBy    uuid.UUID           `json:"trigger_by" gorm:"type:uuid"`
	Stages       []StageRun          `json:"stages,omitempty" gorm:"foreignKey:PipelineRunID"`
	StartedAt    *time.Time          `json:"started_at"`
	FinishedAt   *time.Time          `json:"finished_at"`
	CreatedAt    time.Time           `json:"created_at" gorm:"index"`
	UpdatedAt    time.Time           `json:"updated_at"`
}

func (r *PipelineRun) BeforeCreate(tx *gorm.DB) error {
	if r.ID == uuid.Nil {
		r.ID = uuid.New()
	}
	return nil
}

// StageRun 阶段运行记录
type StageRun struct {
	ID            uuid.UUID  `json:"id" gorm:"type:uuid;primary_key"`
	PipelineRunID uuid.UUID  `json:"pipeline_run_id" gorm:"type:uuid;index;not null"`
	Name          string     `json:"name" gorm:"size:100;not null"`
	Type          string     `json:"type" gorm:"size:20"`  // serial, parallel, approval
	EnvCode       string     `json:"env_code" gorm:"size:20"`
	Sort          int        `json:"sort" gorm:"default:0"`
	Status        string     `json:"status" gorm:"size:20;default:'pending'"`
	Duration      int        `json:"duration" gorm:"default:0"`
	Steps         []StepRun  `json:"steps,omitempty" gorm:"foreignKey:StageRunID"`
	StartedAt     *time.Time `json:"started_at"`
	FinishedAt    *time.Time `json:"finished_at"`
}

func (s *StageRun) BeforeCreate(tx *gorm.DB) error {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	return nil
}

// StepRun 步骤运行记录
type StepRun struct {
	ID         uuid.UUID  `json:"id" gorm:"type:uuid;primary_key"`
	StageRunID uuid.UUID  `json:"stage_run_id" gorm:"type:uuid;index;not null"`
	Name       string     `json:"name" gorm:"size:100;not null"`
	Type       string     `json:"type" gorm:"size:50"` // git_clone, shell, docker_build, docker_push, k8s_deploy, host_deploy, approval, notification
	Config     string     `json:"config" gorm:"type:text"`
	Sort       int        `json:"sort" gorm:"default:0"`
	Status     string     `json:"status" gorm:"size:20;default:'pending'"`
	Log        string     `json:"log" gorm:"type:text"`
	Duration   int        `json:"duration" gorm:"default:0"`
	StartedAt  *time.Time `json:"started_at"`
	FinishedAt *time.Time `json:"finished_at"`
}

func (s *StepRun) BeforeCreate(tx *gorm.DB) error {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	return nil
}

// Artifact 制品
type Artifact struct {
	ID            uuid.UUID    `json:"id" gorm:"type:uuid;primary_key"`
	PipelineRunID uuid.UUID    `json:"pipeline_run_id" gorm:"type:uuid;index"`
	AppID         uuid.UUID    `json:"app_id" gorm:"type:uuid;index;not null"`
	App           *Application `json:"app,omitempty" gorm:"foreignKey:AppID"`
	Name          string       `json:"name" gorm:"size:200;not null"`
	Type          string       `json:"type" gorm:"size:20"`  // docker_image, binary, archive
	Version       string       `json:"version" gorm:"size:100"`
	Size          int64        `json:"size" gorm:"default:0"`
	Registry      string       `json:"registry" gorm:"size:255"`
	Path          string       `json:"path" gorm:"size:500"`
	Digest        string       `json:"digest" gorm:"size:100"` // SHA256
	Metadata      string       `json:"metadata" gorm:"type:text"`
	CreatedBy     uuid.UUID    `json:"created_by" gorm:"type:uuid"`
	CreatedAt     time.Time    `json:"created_at" gorm:"index"`
}

func (a *Artifact) BeforeCreate(tx *gorm.DB) error {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	return nil
}

// ApprovalRecord 审批记录
type ApprovalRecord struct {
	ID            uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	StageRunID    uuid.UUID `json:"stage_run_id" gorm:"type:uuid;index;not null"`
	PipelineRunID uuid.UUID `json:"pipeline_run_id" gorm:"type:uuid;index;not null"`
	ApproverID    uuid.UUID `json:"approver_id" gorm:"type:uuid"`
	ApproverName  string    `json:"approver_name" gorm:"size:50"`
	Action        string    `json:"action" gorm:"size:20"` // approved, rejected
	Comment       string    `json:"comment" gorm:"size:500"`
	CreatedAt     time.Time `json:"created_at"`
}

func (a *ApprovalRecord) BeforeCreate(tx *gorm.DB) error {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	return nil
}
