package service

import (
	"errors"

	"devops/internal/model"
	"devops/internal/repository"

	"github.com/google/uuid"
)

var (
	ErrVersionNotFound = errors.New("version not found")
)

type VersionService struct {
	versionRepo *repository.VersionRepository
	appRepo     *repository.AppRepository
}

func NewVersionService(versionRepo *repository.VersionRepository, appRepo *repository.AppRepository) *VersionService {
	return &VersionService{
		versionRepo: versionRepo,
		appRepo:     appRepo,
	}
}

type CreateVersionRequest struct {
	AppID     uuid.UUID `json:"app_id" binding:"required"`
	Version   string    `json:"version" binding:"required"`
	Branch    string    `json:"branch"`
	CommitID  string    `json:"commit_id"`
	CommitMsg string    `json:"commit_msg"`
	Changelog string    `json:"changelog"`
}

func (s *VersionService) Create(req *CreateVersionRequest, createdBy uuid.UUID) (*model.AppVersion, error) {
	if _, err := s.appRepo.GetByID(req.AppID); err != nil {
		return nil, ErrAppNotFound
	}

	branch := req.Branch
	if branch == "" {
		branch = "main"
	}

	version := &model.AppVersion{
		AppID:       req.AppID,
		Version:     req.Version,
		Branch:      branch,
		CommitID:    req.CommitID,
		CommitMsg:   req.CommitMsg,
		Changelog:   req.Changelog,
		BuildStatus: "pending",
		CreatedBy:   createdBy,
	}

	if err := s.versionRepo.Create(version); err != nil {
		return nil, err
	}

	return s.versionRepo.GetByID(version.ID)
}

type UpdateVersionRequest struct {
	BuildStatus string `json:"build_status"`
	Changelog   string `json:"changelog"`
}

func (s *VersionService) Update(id uuid.UUID, req *UpdateVersionRequest) (*model.AppVersion, error) {
	version, err := s.versionRepo.GetByID(id)
	if err != nil {
		return nil, ErrVersionNotFound
	}

	if req.BuildStatus != "" {
		version.BuildStatus = req.BuildStatus
	}
	if req.Changelog != "" {
		version.Changelog = req.Changelog
	}

	if err := s.versionRepo.Update(version); err != nil {
		return nil, err
	}

	return s.versionRepo.GetByID(id)
}

func (s *VersionService) Delete(id uuid.UUID) error {
	if _, err := s.versionRepo.GetByID(id); err != nil {
		return ErrVersionNotFound
	}
	return s.versionRepo.Delete(id)
}

func (s *VersionService) GetByID(id uuid.UUID) (*model.AppVersion, error) {
	return s.versionRepo.GetByID(id)
}

func (s *VersionService) List(page, pageSize int, appID *uuid.UUID, keyword string) ([]model.AppVersion, int64, error) {
	return s.versionRepo.List(page, pageSize, appID, keyword)
}

func (s *VersionService) SetCurrent(id uuid.UUID) (*model.AppVersion, error) {
	version, err := s.versionRepo.GetByID(id)
	if err != nil {
		return nil, ErrVersionNotFound
	}

	if err := s.versionRepo.SetCurrentVersion(version.AppID, id); err != nil {
		return nil, err
	}

	return s.versionRepo.GetByID(id)
}

func (s *VersionService) Deploy(id uuid.UUID) (*model.AppVersion, error) {
	version, err := s.versionRepo.GetByID(id)
	if err != nil {
		return nil, ErrVersionNotFound
	}

	if err := s.versionRepo.IncrementDeployCount(id); err != nil {
		return nil, err
	}

	if err := s.versionRepo.SetCurrentVersion(version.AppID, id); err != nil {
		return nil, err
	}

	return s.versionRepo.GetByID(id)
}
