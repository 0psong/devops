package cloud

import "fmt"

// AliCloudProvider 阿里云 ECS 实现（Stub）
type AliCloudProvider struct {
	accessKey string
	secretKey string
	region    string
}

func NewAliCloudProvider(accessKey, secretKey, region string) *AliCloudProvider {
	return &AliCloudProvider{accessKey: accessKey, secretKey: secretKey, region: region}
}

func (p *AliCloudProvider) ValidateCredentials() error {
	if p.accessKey == "" || p.secretKey == "" {
		return fmt.Errorf("access_key and secret_key are required")
	}
	// TODO: 接入阿里云 SDK 验证凭证
	return nil
}

func (p *AliCloudProvider) ListRegions() ([]Region, error) {
	// TODO: 接入阿里云 SDK
	return []Region{
		{ID: "cn-hangzhou", Name: "华东1（杭州）"},
		{ID: "cn-shanghai", Name: "华东2（上海）"},
		{ID: "cn-beijing", Name: "华北2（北京）"},
		{ID: "cn-shenzhen", Name: "华南1（深圳）"},
		{ID: "cn-hongkong", Name: "中国香港"},
	}, nil
}

func (p *AliCloudProvider) ListZones(region string) ([]Zone, error) {
	// TODO: 接入阿里云 SDK
	return []Zone{
		{ID: region + "-a", Name: "可用区A", RegionID: region},
		{ID: region + "-b", Name: "可用区B", RegionID: region},
	}, nil
}

func (p *AliCloudProvider) ListInstanceTypes(region string) ([]InstanceTypeInfo, error) {
	// TODO: 接入阿里云 SDK
	return []InstanceTypeInfo{
		{ID: "ecs.c6.large", Name: "计算型 c6 (2C4G)", CPU: 2, Memory: 4096},
		{ID: "ecs.c6.xlarge", Name: "计算型 c6 (4C8G)", CPU: 4, Memory: 8192},
		{ID: "ecs.g6.large", Name: "通用型 g6 (2C8G)", CPU: 2, Memory: 8192},
		{ID: "ecs.g6.xlarge", Name: "通用型 g6 (4C16G)", CPU: 4, Memory: 16384},
		{ID: "ecs.r6.large", Name: "内存型 r6 (2C16G)", CPU: 2, Memory: 16384},
	}, nil
}

func (p *AliCloudProvider) ListImages(region string) ([]Image, error) {
	// TODO: 接入阿里云 SDK
	return []Image{
		{ID: "centos_7_9_x64_20G", Name: "CentOS 7.9 64位", OS: "CentOS"},
		{ID: "ubuntu_22_04_x64_20G", Name: "Ubuntu 22.04 64位", OS: "Ubuntu"},
		{ID: "aliyun_3_x64_20G", Name: "Alibaba Cloud Linux 3", OS: "Alinux"},
	}, nil
}

func (p *AliCloudProvider) CreateInstance(req CreateInstanceRequest) (*Instance, error) {
	// TODO: 接入阿里云 ECS SDK 创建实例
	return nil, fmt.Errorf("alicloud CreateInstance not implemented: please integrate alicloud ECS SDK")
}

func (p *AliCloudProvider) StartInstance(instanceID string) error {
	// TODO: 接入阿里云 ECS SDK
	return fmt.Errorf("alicloud StartInstance not implemented")
}

func (p *AliCloudProvider) StopInstance(instanceID string) error {
	// TODO: 接入阿里云 ECS SDK
	return fmt.Errorf("alicloud StopInstance not implemented")
}

func (p *AliCloudProvider) TerminateInstance(instanceID string) error {
	// TODO: 接入阿里云 ECS SDK
	return fmt.Errorf("alicloud TerminateInstance not implemented")
}

func (p *AliCloudProvider) GetInstanceStatus(instanceID string) (string, error) {
	// TODO: 接入阿里云 ECS SDK
	return "unknown", fmt.Errorf("alicloud GetInstanceStatus not implemented")
}

func (p *AliCloudProvider) ListInstances(region string) ([]Instance, error) {
	// TODO: 接入阿里云 ECS SDK
	return nil, fmt.Errorf("alicloud ListInstances not implemented")
}
