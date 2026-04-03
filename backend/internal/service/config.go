package service

import (
	"errors"
	"fmt"
	"log"

	"devops/internal/model"
	"devops/internal/pkg/crypto"
	"devops/internal/repository"

	"github.com/google/uuid"
)

var (
	ErrConfigNotFound  = errors.New("config item not found")
	ErrConfigKeyExists = errors.New("config key already exists")
)

type ConfigService struct {
	configRepo  *repository.ConfigRepository
	historyRepo *repository.ConfigHistoryRepository
	encryptor   *crypto.Encryptor
}

func NewConfigService(configRepo *repository.ConfigRepository, historyRepo *repository.ConfigHistoryRepository, encryptKey string) *ConfigService {
	return &ConfigService{
		configRepo:  configRepo,
		historyRepo: historyRepo,
		encryptor:   crypto.NewEncryptor(encryptKey),
	}
}

type CreateConfigRequest struct {
	Key         string `json:"key" binding:"required"`
	Value       string `json:"value"`
	ValueType   string `json:"value_type"`
	EnvCode     string `json:"env_code" binding:"required"`
	AppCode     string `json:"app_code"`
	IsSecret    bool   `json:"is_secret"`
	Description string `json:"description"`
}

func (s *ConfigService) Create(req *CreateConfigRequest, createdBy uuid.UUID, username string) (*model.ConfigItem, error) {
	// Check if key exists
	if _, err := s.configRepo.GetByKey(req.Key, req.EnvCode, req.AppCode); err == nil {
		return nil, ErrConfigKeyExists
	}

	valueType := req.ValueType
	if valueType == "" {
		valueType = "string"
	}

	value := req.Value
	if req.IsSecret && value != "" {
		encrypted, err := s.encryptor.Encrypt(value)
		if err != nil {
			return nil, err
		}
		value = encrypted
	}

	config := &model.ConfigItem{
		Key:         req.Key,
		Value:       value,
		ValueType:   valueType,
		EnvCode:     req.EnvCode,
		AppCode:     req.AppCode,
		IsSecret:    req.IsSecret,
		Description: req.Description,
		Version:     1,
		CreatedBy:   createdBy,
		UpdatedBy:   createdBy,
	}

	if err := s.configRepo.Create(config); err != nil {
		return nil, err
	}

	// Create history
	history := &model.ConfigHistory{
		ConfigID:  config.ID,
		Key:       config.Key,
		OldValue:  "",
		NewValue:  func() string { if req.IsSecret { return "[encrypted]" }; return req.Value }(),
		EnvCode:   config.EnvCode,
		AppCode:   config.AppCode,
		Version:   1,
		Action:    "create",
		CreatedBy: createdBy,
		Username:  username,
	}
	if err := s.historyRepo.Create(history); err != nil {
		log.Printf("Failed to create config history: %v", err)
	}

	return config, nil
}

type UpdateConfigRequest struct {
	Value       string `json:"value"`
	Description string `json:"description"`
}

func (s *ConfigService) Update(id uuid.UUID, req *UpdateConfigRequest, updatedBy uuid.UUID, username string) (*model.ConfigItem, error) {
	config, err := s.configRepo.GetByID(id)
	if err != nil {
		return nil, ErrConfigNotFound
	}

	// Don't store plaintext secrets in history
	oldValue := config.Value
	if config.IsSecret {
		oldValue = "[encrypted]"
	}

	newValue := req.Value
	if config.IsSecret && newValue != "" {
		encrypted, err := s.encryptor.Encrypt(newValue)
		if err != nil {
			return nil, err
		}
		config.Value = encrypted
	} else {
		config.Value = newValue
	}

	if req.Description != "" {
		config.Description = req.Description
	}

	config.Version++
	config.UpdatedBy = updatedBy

	if err := s.configRepo.Update(config); err != nil {
		return nil, err
	}

	// Create history
	history := &model.ConfigHistory{
		ConfigID:  config.ID,
		Key:       config.Key,
		OldValue:  oldValue,
		NewValue:  func() string { if config.IsSecret { return "[encrypted]" }; return req.Value }(),
		EnvCode:   config.EnvCode,
		AppCode:   config.AppCode,
		Version:   config.Version,
		Action:    "update",
		CreatedBy: updatedBy,
		Username:  username,
	}
	if err := s.historyRepo.Create(history); err != nil {
		log.Printf("Failed to create config history: %v", err)
	}

	return config, nil
}

func (s *ConfigService) Delete(id uuid.UUID, deletedBy uuid.UUID, username string) error {
	config, err := s.configRepo.GetByID(id)
	if err != nil {
		return ErrConfigNotFound
	}

	// Create history
	history := &model.ConfigHistory{
		ConfigID:  config.ID,
		Key:       config.Key,
		OldValue:  func() string { if config.IsSecret { return "[encrypted]" }; return config.Value }(),
		NewValue:  "",
		EnvCode:   config.EnvCode,
		AppCode:   config.AppCode,
		Version:   config.Version,
		Action:    "delete",
		CreatedBy: deletedBy,
		Username:  username,
	}
	if err := s.historyRepo.Create(history); err != nil {
		log.Printf("Failed to create config history: %v", err)
	}

	return s.configRepo.Delete(id)
}

func (s *ConfigService) GetByID(id uuid.UUID, decrypt bool) (*model.ConfigItem, error) {
	config, err := s.configRepo.GetByID(id)
	if err != nil {
		return nil, err
	}

	if decrypt && config.IsSecret {
		decrypted, err := s.encryptor.Decrypt(config.Value)
		if err != nil {
			return nil, fmt.Errorf("decrypt config value: %w", err)
		}
		config.Value = decrypted
	}

	return config, nil
}

func (s *ConfigService) List(page, pageSize int, envCode, appCode, keyword string) ([]model.ConfigItem, int64, error) {
	return s.configRepo.List(page, pageSize, envCode, appCode, keyword)
}

func (s *ConfigService) GetByEnvAndApp(envCode, appCode string, decrypt bool) ([]model.ConfigItem, error) {
	configs, err := s.configRepo.GetByEnvAndApp(envCode, appCode)
	if err != nil {
		return nil, err
	}

	if decrypt {
		for i := range configs {
			if configs[i].IsSecret {
				decrypted, err := s.encryptor.Decrypt(configs[i].Value)
				if err != nil {
					return nil, fmt.Errorf("decrypt config %s: %w", configs[i].Key, err)
				}
				configs[i].Value = decrypted
			}
		}
	}

	return configs, nil
}

func (s *ConfigService) GetHistory(configID uuid.UUID, limit int) ([]model.ConfigHistory, error) {
	return s.historyRepo.ListByConfigID(configID, limit)
}
