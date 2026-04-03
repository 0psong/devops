package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AppVersion struct {
	ID          uuid.UUID      `json:"id" gorm:"type:uuid;primary_key"`
	AppID       uuid.UUID      `json:"app_id" gorm:"type:uuid;index;not null"`
	App         *Application   `json:"app,omitempty" gorm:"foreignKey:AppID"`
	Version     string         `json:"version" gorm:"size:50;not null;index"`
	Branch      string         `json:"branch" gorm:"size:100;default:'main'"`
	CommitID    string         `json:"commit_id" gorm:"size:50"`
	CommitMsg   string         `json:"commit_msg" gorm:"size:500"`
	Changelog   string         `json:"changelog" gorm:"type:text"`
	BuildStatus string         `json:"build_status" gorm:"size:20;default:'pending'"` // pending, building, success, failed
	IsCurrent   bool           `json:"is_current" gorm:"default:false;index"`
	DeployCount int            `json:"deploy_count" gorm:"default:0"`
	CreatedBy   uuid.UUID      `json:"created_by" gorm:"type:uuid"`
	CreatedAt   time.Time      `json:"created_at" gorm:"index"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`
}

func (v *AppVersion) BeforeCreate(tx *gorm.DB) error {
	if v.ID == uuid.Nil {
		v.ID = uuid.New()
	}
	return nil
}
