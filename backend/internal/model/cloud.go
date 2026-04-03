package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// CloudAccount 云账号
type CloudAccount struct {
	ID          uuid.UUID      `json:"id" gorm:"type:uuid;primary_key"`
	Name        string         `json:"name" gorm:"size:100;not null"`
	Provider    string         `json:"provider" gorm:"size:20;not null;index"` // alicloud, aws
	AccessKey   string         `json:"-" gorm:"size:500;not null"`
	SecretKey   string         `json:"-" gorm:"size:500;not null"`
	Region      string         `json:"region" gorm:"size:50"`
	Status      int            `json:"status" gorm:"default:1;index"` // 1=normal, 0=disabled, 2=verify_failed
	Description string         `json:"description" gorm:"size:255"`
	CreatedBy   uuid.UUID      `json:"created_by" gorm:"type:uuid"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`
}

func (a *CloudAccount) BeforeCreate(tx *gorm.DB) error {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	return nil
}

// CloudInstance 云主机实例
type CloudInstance struct {
	ID           uuid.UUID      `json:"id" gorm:"type:uuid;primary_key"`
	AccountID    uuid.UUID      `json:"account_id" gorm:"type:uuid;index;not null"`
	Account      *CloudAccount  `json:"account,omitempty" gorm:"foreignKey:AccountID"`
	InstanceID   string         `json:"instance_id" gorm:"size:100;index"`
	Name         string         `json:"name" gorm:"size:100;not null"`
	Provider     string         `json:"provider" gorm:"size:20;not null;index"`
	Region       string         `json:"region" gorm:"size:50"`
	Zone         string         `json:"zone" gorm:"size:50"`
	InstanceType string         `json:"instance_type" gorm:"size:50"`
	ImageID      string         `json:"image_id" gorm:"size:100"`
	CPU          int            `json:"cpu" gorm:"default:0"`
	Memory       int            `json:"memory" gorm:"default:0"` // MB
	PublicIP     string         `json:"public_ip" gorm:"size:50"`
	PrivateIP    string         `json:"private_ip" gorm:"size:50"`
	Status       string         `json:"status" gorm:"size:20;default:'pending';index"` // pending, running, stopped, terminated
	HostID       *uuid.UUID     `json:"host_id" gorm:"type:uuid;index"`
	Host         *Host          `json:"host,omitempty" gorm:"foreignKey:HostID"`
	ClusterID    *uuid.UUID     `json:"cluster_id" gorm:"type:uuid;index"`
	NodePoolID   *uuid.UUID     `json:"node_pool_id" gorm:"type:uuid;index"`
	ExpireAt     *time.Time     `json:"expire_at"`
	ChargeType   string         `json:"charge_type" gorm:"size:20"` // PostPaid, PrePaid
	CreatedBy    uuid.UUID      `json:"created_by" gorm:"type:uuid"`
	CreatedAt    time.Time      `json:"created_at" gorm:"index"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `json:"-" gorm:"index"`
}

func (i *CloudInstance) BeforeCreate(tx *gorm.DB) error {
	if i.ID == uuid.Nil {
		i.ID = uuid.New()
	}
	return nil
}

// NodePool K8s节点池
type NodePool struct {
	ID           uuid.UUID      `json:"id" gorm:"type:uuid;primary_key"`
	ClusterID    uuid.UUID      `json:"cluster_id" gorm:"type:uuid;index;not null"`
	Cluster      *Cluster       `json:"cluster,omitempty" gorm:"foreignKey:ClusterID"`
	AccountID    uuid.UUID      `json:"account_id" gorm:"type:uuid;index;not null"`
	Account      *CloudAccount  `json:"account,omitempty" gorm:"foreignKey:AccountID"`
	Name         string         `json:"name" gorm:"size:100;not null"`
	InstanceType string         `json:"instance_type" gorm:"size:50"`
	ImageID      string         `json:"image_id" gorm:"size:100"`
	MinSize      int            `json:"min_size" gorm:"default:0"`
	MaxSize      int            `json:"max_size" gorm:"default:10"`
	DesiredSize  int            `json:"desired_size" gorm:"default:0"`
	CurrentSize  int            `json:"current_size" gorm:"default:0"`
	Status       string         `json:"status" gorm:"size:20;default:'active'"` // active, scaling, error
	Description  string         `json:"description" gorm:"size:255"`
	CreatedBy    uuid.UUID      `json:"created_by" gorm:"type:uuid"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `json:"-" gorm:"index"`
}

func (n *NodePool) BeforeCreate(tx *gorm.DB) error {
	if n.ID == uuid.Nil {
		n.ID = uuid.New()
	}
	return nil
}
