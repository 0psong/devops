package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Pipeline struct {
	ID         uuid.UUID       `json:"id" gorm:"type:uuid;primary_key"`
	Name       string          `json:"name" gorm:"size:100;not null"`
	AppID      uuid.UUID       `json:"app_id" gorm:"type:uuid;index;not null"`
	App        *Application    `json:"app,omitempty" gorm:"foreignKey:AppID"`
	Branch     string          `json:"branch" gorm:"size:100;default:'main'"`
	Status     string          `json:"status" gorm:"size:20;default:'pending'"` // pending, running, success, failed, cancelled
	Trigger    string          `json:"trigger" gorm:"size:20;default:'manual'"` // manual, webhook, schedule
	Duration   int             `json:"duration" gorm:"default:0"`               // seconds
	CreatedBy  uuid.UUID       `json:"created_by" gorm:"type:uuid"`
	StartedAt  *time.Time      `json:"started_at"`
	FinishedAt *time.Time      `json:"finished_at"`
	CreatedAt  time.Time       `json:"created_at" gorm:"index"`
	UpdatedAt  time.Time       `json:"updated_at"`
	DeletedAt  gorm.DeletedAt  `json:"-" gorm:"index"`
	Stages     []PipelineStage `json:"stages,omitempty" gorm:"foreignKey:PipelineID"`
}

func (p *Pipeline) BeforeCreate(tx *gorm.DB) error {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	return nil
}

type PipelineStage struct {
	ID         uuid.UUID  `json:"id" gorm:"type:uuid;primary_key"`
	PipelineID uuid.UUID  `json:"pipeline_id" gorm:"type:uuid;index;not null"`
	Name       string     `json:"name" gorm:"size:100;not null"`
	Status     string     `json:"status" gorm:"size:20;default:'pending'"` // pending, running, success, failed, skipped
	Sort       int        `json:"sort" gorm:"default:0"`
	Duration   int        `json:"duration" gorm:"default:0"`
	Log        string     `json:"log" gorm:"type:text"`
	StartedAt  *time.Time `json:"started_at"`
	FinishedAt *time.Time `json:"finished_at"`
}

func (s *PipelineStage) BeforeCreate(tx *gorm.DB) error {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	return nil
}
