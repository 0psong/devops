package service

import (
	"errors"
	"time"

	"devops/internal/model"
	"devops/internal/repository"

	"github.com/google/uuid"
)

var (
	ErrPipelineNotFound = errors.New("pipeline not found")
)

type PipelineService struct {
	pipelineRepo *repository.PipelineRepository
	appRepo      *repository.AppRepository
}

func NewPipelineService(pipelineRepo *repository.PipelineRepository, appRepo *repository.AppRepository) *PipelineService {
	return &PipelineService{
		pipelineRepo: pipelineRepo,
		appRepo:      appRepo,
	}
}

type CreatePipelineRequest struct {
	Name    string    `json:"name" binding:"required"`
	AppID   uuid.UUID `json:"app_id" binding:"required"`
	Branch  string    `json:"branch"`
	Trigger string    `json:"trigger"`
}

func (s *PipelineService) Create(req *CreatePipelineRequest, createdBy uuid.UUID) (*model.Pipeline, error) {
	if _, err := s.appRepo.GetByID(req.AppID); err != nil {
		return nil, ErrAppNotFound
	}

	branch := req.Branch
	if branch == "" {
		branch = "main"
	}
	trigger := req.Trigger
	if trigger == "" {
		trigger = "manual"
	}

	pipeline := &model.Pipeline{
		Name:      req.Name,
		AppID:     req.AppID,
		Branch:    branch,
		Status:    "pending",
		Trigger:   trigger,
		CreatedBy: createdBy,
		Stages: []model.PipelineStage{
			{Name: "代码拉取", Status: "pending", Sort: 1},
			{Name: "代码构建", Status: "pending", Sort: 2},
			{Name: "单元测试", Status: "pending", Sort: 3},
			{Name: "镜像打包", Status: "pending", Sort: 4},
			{Name: "部署发布", Status: "pending", Sort: 5},
		},
	}

	if err := s.pipelineRepo.Create(pipeline); err != nil {
		return nil, err
	}

	return s.pipelineRepo.GetByID(pipeline.ID)
}

func (s *PipelineService) GetByID(id uuid.UUID) (*model.Pipeline, error) {
	return s.pipelineRepo.GetByID(id)
}

func (s *PipelineService) List(page, pageSize int, appID *uuid.UUID, status string) ([]model.Pipeline, int64, error) {
	return s.pipelineRepo.List(page, pageSize, appID, status)
}

func (s *PipelineService) Delete(id uuid.UUID) error {
	if _, err := s.pipelineRepo.GetByID(id); err != nil {
		return ErrPipelineNotFound
	}
	return s.pipelineRepo.Delete(id)
}

func (s *PipelineService) Run(id uuid.UUID) (*model.Pipeline, error) {
	pipeline, err := s.pipelineRepo.GetByID(id)
	if err != nil {
		return nil, ErrPipelineNotFound
	}

	now := time.Now()
	pipeline.Status = "running"
	pipeline.StartedAt = &now

	if err := s.pipelineRepo.Update(pipeline); err != nil {
		return nil, err
	}

	return s.pipelineRepo.GetByID(id)
}

func (s *PipelineService) Cancel(id uuid.UUID) (*model.Pipeline, error) {
	pipeline, err := s.pipelineRepo.GetByID(id)
	if err != nil {
		return nil, ErrPipelineNotFound
	}

	now := time.Now()
	pipeline.Status = "cancelled"
	pipeline.FinishedAt = &now

	if err := s.pipelineRepo.Update(pipeline); err != nil {
		return nil, err
	}

	return s.pipelineRepo.GetByID(id)
}
