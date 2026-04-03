package service

import (
	"encoding/json"
	"errors"
	"time"

	"devops/internal/model"
	"devops/internal/repository"

	"github.com/google/uuid"
)

var (
	ErrPipelineDefNotFound = errors.New("pipeline definition not found")
	ErrPipelineRunNotFound = errors.New("pipeline run not found")
	ErrApprovalNotPending  = errors.New("no pending approval stage")
	ErrArtifactNotFound    = errors.New("artifact not found")
)

type PipelineV2Service struct {
	defRepo      *repository.PipelineDefinitionRepository
	runRepo      *repository.PipelineRunRepository
	stageRunRepo *repository.StageRunRepository
	stepRunRepo  *repository.StepRunRepository
	artifactRepo *repository.ArtifactRepository
	approvalRepo *repository.ApprovalRepository
	appRepo      *repository.AppRepository
}

func NewPipelineV2Service(
	defRepo *repository.PipelineDefinitionRepository,
	runRepo *repository.PipelineRunRepository,
	stageRunRepo *repository.StageRunRepository,
	stepRunRepo *repository.StepRunRepository,
	artifactRepo *repository.ArtifactRepository,
	approvalRepo *repository.ApprovalRepository,
	appRepo *repository.AppRepository,
) *PipelineV2Service {
	return &PipelineV2Service{
		defRepo:      defRepo,
		runRepo:      runRepo,
		stageRunRepo: stageRunRepo,
		stepRunRepo:  stepRunRepo,
		artifactRepo: artifactRepo,
		approvalRepo: approvalRepo,
		appRepo:      appRepo,
	}
}

// --- 流水线定义 CRUD ---

type CreateDefinitionRequest struct {
	Name          string `json:"name" binding:"required"`
	AppID         string `json:"app_id" binding:"required"`
	Description   string `json:"description"`
	Config        string `json:"config"`
	EnvVars       string `json:"env_vars"`
	TriggerType   string `json:"trigger_type"`
	TriggerConfig string `json:"trigger_config"`
}

type UpdateDefinitionRequest struct {
	Name          string `json:"name"`
	Description   string `json:"description"`
	Config        string `json:"config"`
	EnvVars       string `json:"env_vars"`
	TriggerType   string `json:"trigger_type"`
	TriggerConfig string `json:"trigger_config"`
	Enabled       *bool  `json:"enabled"`
}

func (s *PipelineV2Service) CreateDefinition(req *CreateDefinitionRequest, createdBy uuid.UUID) (*model.PipelineDefinition, error) {
	appID, err := uuid.Parse(req.AppID)
	if err != nil {
		return nil, ErrAppNotFound
	}

	if _, err := s.appRepo.GetByID(appID); err != nil {
		return nil, ErrAppNotFound
	}

	triggerType := req.TriggerType
	if triggerType == "" {
		triggerType = "manual"
	}

	def := &model.PipelineDefinition{
		Name:          req.Name,
		AppID:         appID,
		Description:   req.Description,
		Config:        req.Config,
		EnvVars:       req.EnvVars,
		TriggerType:   triggerType,
		TriggerConfig: req.TriggerConfig,
		Enabled:       true,
		CreatedBy:     createdBy,
	}

	if err := s.defRepo.Create(def); err != nil {
		return nil, err
	}

	return s.defRepo.GetByID(def.ID)
}

func (s *PipelineV2Service) GetDefinition(id uuid.UUID) (*model.PipelineDefinition, error) {
	return s.defRepo.GetByID(id)
}

func (s *PipelineV2Service) UpdateDefinition(id uuid.UUID, req *UpdateDefinitionRequest) (*model.PipelineDefinition, error) {
	def, err := s.defRepo.GetByID(id)
	if err != nil {
		return nil, ErrPipelineDefNotFound
	}

	if req.Name != "" {
		def.Name = req.Name
	}
	if req.Description != "" {
		def.Description = req.Description
	}
	if req.Config != "" {
		def.Config = req.Config
	}
	if req.EnvVars != "" {
		def.EnvVars = req.EnvVars
	}
	if req.TriggerType != "" {
		def.TriggerType = req.TriggerType
	}
	if req.TriggerConfig != "" {
		def.TriggerConfig = req.TriggerConfig
	}
	if req.Enabled != nil {
		def.Enabled = *req.Enabled
	}

	if err := s.defRepo.Update(def); err != nil {
		return nil, err
	}

	return s.defRepo.GetByID(id)
}

func (s *PipelineV2Service) DeleteDefinition(id uuid.UUID) error {
	if _, err := s.defRepo.GetByID(id); err != nil {
		return ErrPipelineDefNotFound
	}
	return s.defRepo.Delete(id)
}

func (s *PipelineV2Service) ListDefinitions(page, pageSize int, appID *uuid.UUID, keyword string) ([]model.PipelineDefinition, int64, error) {
	return s.defRepo.List(page, pageSize, appID, keyword)
}

// --- 流水线运行管理 ---

type TriggerRunRequest struct {
	Branch   string `json:"branch"`
	CommitID string `json:"commit_id"`
	EnvVars  string `json:"env_vars"`
}

type StageConfig struct {
	Name    string       `json:"name"`
	Type    string       `json:"type"`
	EnvCode string       `json:"env_code"`
	Steps   []StepConfig `json:"steps"`
}

type StepConfig struct {
	Name   string `json:"name"`
	Type   string `json:"type"`
	Config string `json:"config"`
}

func (s *PipelineV2Service) TriggerRun(defID uuid.UUID, req *TriggerRunRequest, triggerBy uuid.UUID) (*model.PipelineRun, error) {
	def, err := s.defRepo.GetByID(defID)
	if err != nil {
		return nil, ErrPipelineDefNotFound
	}

	runNumber, err := s.runRepo.GetNextRunNumber(defID)
	if err != nil {
		return nil, err
	}

	envVars := req.EnvVars
	if envVars == "" {
		envVars = def.EnvVars
	}

	now := time.Now()
	run := &model.PipelineRun{
		DefinitionID: defID,
		RunNumber:    runNumber,
		Status:       "running",
		Branch:       req.Branch,
		CommitID:     req.CommitID,
		EnvVars:      envVars,
		TriggerType:  def.TriggerType,
		TriggerBy:    triggerBy,
		StartedAt:    &now,
	}

	if err := s.runRepo.Create(run); err != nil {
		return nil, err
	}

	// 解析 Config 创建 StageRun + StepRun
	if def.Config != "" {
		var stages []StageConfig
		if err := json.Unmarshal([]byte(def.Config), &stages); err == nil {
			for i, sc := range stages {
				stageType := sc.Type
				if stageType == "" {
					stageType = "serial"
				}

				stageStatus := "pending"
				if i == 0 {
					stageStatus = "running"
				}
				if stageType == "approval" {
					stageStatus = "pending"
				}

				stage := &model.StageRun{
					PipelineRunID: run.ID,
					Name:          sc.Name,
					Type:          stageType,
					EnvCode:       sc.EnvCode,
					Sort:          i + 1,
					Status:        stageStatus,
				}
				s.stageRunRepo.Create(stage)

				for j, stepCfg := range sc.Steps {
					step := &model.StepRun{
						StageRunID: stage.ID,
						Name:       stepCfg.Name,
						Type:       stepCfg.Type,
						Config:     stepCfg.Config,
						Sort:       j + 1,
						Status:     "pending",
					}
					s.stepRunRepo.Create(step)
				}
			}
		}
	}

	return s.runRepo.GetByID(run.ID)
}

func (s *PipelineV2Service) GetRun(id uuid.UUID) (*model.PipelineRun, error) {
	return s.runRepo.GetByID(id)
}

func (s *PipelineV2Service) ListRuns(page, pageSize int, defID *uuid.UUID, status string) ([]model.PipelineRun, int64, error) {
	return s.runRepo.List(page, pageSize, defID, status)
}

func (s *PipelineV2Service) CancelRun(id uuid.UUID) (*model.PipelineRun, error) {
	run, err := s.runRepo.GetByID(id)
	if err != nil {
		return nil, ErrPipelineRunNotFound
	}

	now := time.Now()
	run.Status = "cancelled"
	run.FinishedAt = &now
	if run.StartedAt != nil {
		run.Duration = int(now.Sub(*run.StartedAt).Seconds())
	}

	if err := s.runRepo.Update(run); err != nil {
		return nil, err
	}

	return s.runRepo.GetByID(id)
}

func (s *PipelineV2Service) RetryRun(id uuid.UUID, triggerBy uuid.UUID) (*model.PipelineRun, error) {
	oldRun, err := s.runRepo.GetByID(id)
	if err != nil {
		return nil, ErrPipelineRunNotFound
	}

	req := &TriggerRunRequest{
		Branch:   oldRun.Branch,
		CommitID: oldRun.CommitID,
		EnvVars:  oldRun.EnvVars,
	}

	return s.TriggerRun(oldRun.DefinitionID, req, triggerBy)
}

// --- 阶段 & 步骤 ---

func (s *PipelineV2Service) GetStages(runID uuid.UUID) ([]model.StageRun, error) {
	return s.stageRunRepo.ListByRunID(runID)
}

func (s *PipelineV2Service) GetStepLog(stepID uuid.UUID) (string, error) {
	step, err := s.stepRunRepo.GetByID(stepID)
	if err != nil {
		return "", err
	}
	return step.Log, nil
}

// --- 审批 ---

func (s *PipelineV2Service) ApproveRun(runID uuid.UUID, approverID uuid.UUID, approverName, comment string) error {
	stage, err := s.stageRunRepo.FindWaitingApproval(runID)
	if err != nil {
		return ErrApprovalNotPending
	}

	now := time.Now()
	stage.Status = "approved"
	stage.FinishedAt = &now
	if err := s.stageRunRepo.Update(stage); err != nil {
		return err
	}

	record := &model.ApprovalRecord{
		StageRunID:    stage.ID,
		PipelineRunID: runID,
		ApproverID:    approverID,
		ApproverName:  approverName,
		Action:        "approved",
		Comment:       comment,
	}

	return s.approvalRepo.Create(record)
}

func (s *PipelineV2Service) RejectRun(runID uuid.UUID, approverID uuid.UUID, approverName, comment string) error {
	stage, err := s.stageRunRepo.FindWaitingApproval(runID)
	if err != nil {
		return ErrApprovalNotPending
	}

	now := time.Now()
	stage.Status = "rejected"
	stage.FinishedAt = &now
	if err := s.stageRunRepo.Update(stage); err != nil {
		return err
	}

	// 标记整个运行失败
	run, err := s.runRepo.GetByID(runID)
	if err == nil {
		run.Status = "failed"
		run.FinishedAt = &now
		if run.StartedAt != nil {
			run.Duration = int(now.Sub(*run.StartedAt).Seconds())
		}
		s.runRepo.Update(run)
	}

	record := &model.ApprovalRecord{
		StageRunID:    stage.ID,
		PipelineRunID: runID,
		ApproverID:    approverID,
		ApproverName:  approverName,
		Action:        "rejected",
		Comment:       comment,
	}

	return s.approvalRepo.Create(record)
}

func (s *PipelineV2Service) ListPendingApprovals(page, pageSize int) ([]model.PipelineRun, int64, error) {
	return s.approvalRepo.ListPending(page, pageSize)
}

// --- 制品管理 ---

type CreateArtifactRequest struct {
	PipelineRunID string `json:"pipeline_run_id"`
	AppID         string `json:"app_id" binding:"required"`
	Name          string `json:"name" binding:"required"`
	Type          string `json:"type"`
	Version       string `json:"version"`
	Size          int64  `json:"size"`
	Registry      string `json:"registry"`
	Path          string `json:"path"`
	Digest        string `json:"digest"`
	Metadata      string `json:"metadata"`
}

func (s *PipelineV2Service) CreateArtifact(req *CreateArtifactRequest, createdBy uuid.UUID) (*model.Artifact, error) {
	appID, err := uuid.Parse(req.AppID)
	if err != nil {
		return nil, ErrAppNotFound
	}

	artifact := &model.Artifact{
		AppID:     appID,
		Name:      req.Name,
		Type:      req.Type,
		Version:   req.Version,
		Size:      req.Size,
		Registry:  req.Registry,
		Path:      req.Path,
		Digest:    req.Digest,
		Metadata:  req.Metadata,
		CreatedBy: createdBy,
	}

	if req.PipelineRunID != "" {
		if runID, err := uuid.Parse(req.PipelineRunID); err == nil {
			artifact.PipelineRunID = runID
		}
	}

	if err := s.artifactRepo.Create(artifact); err != nil {
		return nil, err
	}

	return s.artifactRepo.GetByID(artifact.ID)
}

func (s *PipelineV2Service) GetArtifact(id uuid.UUID) (*model.Artifact, error) {
	return s.artifactRepo.GetByID(id)
}

func (s *PipelineV2Service) DeleteArtifact(id uuid.UUID) error {
	if _, err := s.artifactRepo.GetByID(id); err != nil {
		return ErrArtifactNotFound
	}
	return s.artifactRepo.Delete(id)
}

func (s *PipelineV2Service) ListArtifacts(page, pageSize int, appID *uuid.UUID, runID *uuid.UUID) ([]model.Artifact, int64, error) {
	return s.artifactRepo.List(page, pageSize, appID, runID)
}
