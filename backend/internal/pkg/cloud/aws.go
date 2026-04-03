package cloud

import "fmt"

// AWSProvider AWS EC2 实现（Stub）
type AWSProvider struct {
	accessKey string
	secretKey string
	region    string
}

func NewAWSProvider(accessKey, secretKey, region string) *AWSProvider {
	return &AWSProvider{accessKey: accessKey, secretKey: secretKey, region: region}
}

func (p *AWSProvider) ValidateCredentials() error {
	if p.accessKey == "" || p.secretKey == "" {
		return fmt.Errorf("access_key and secret_key are required")
	}
	// TODO: 接入 AWS SDK 验证凭证
	return nil
}

func (p *AWSProvider) ListRegions() ([]Region, error) {
	// TODO: 接入 AWS SDK
	return []Region{
		{ID: "us-east-1", Name: "US East (N. Virginia)"},
		{ID: "us-west-2", Name: "US West (Oregon)"},
		{ID: "ap-southeast-1", Name: "Asia Pacific (Singapore)"},
		{ID: "ap-northeast-1", Name: "Asia Pacific (Tokyo)"},
		{ID: "eu-west-1", Name: "Europe (Ireland)"},
	}, nil
}

func (p *AWSProvider) ListZones(region string) ([]Zone, error) {
	// TODO: 接入 AWS SDK
	return []Zone{
		{ID: region + "a", Name: region + "a", RegionID: region},
		{ID: region + "b", Name: region + "b", RegionID: region},
		{ID: region + "c", Name: region + "c", RegionID: region},
	}, nil
}

func (p *AWSProvider) ListInstanceTypes(region string) ([]InstanceTypeInfo, error) {
	// TODO: 接入 AWS SDK
	return []InstanceTypeInfo{
		{ID: "t3.medium", Name: "T3 Medium (2C4G)", CPU: 2, Memory: 4096},
		{ID: "t3.large", Name: "T3 Large (2C8G)", CPU: 2, Memory: 8192},
		{ID: "m5.large", Name: "M5 Large (2C8G)", CPU: 2, Memory: 8192},
		{ID: "m5.xlarge", Name: "M5 XLarge (4C16G)", CPU: 4, Memory: 16384},
		{ID: "c5.xlarge", Name: "C5 XLarge (4C8G)", CPU: 4, Memory: 8192},
	}, nil
}

func (p *AWSProvider) ListImages(region string) ([]Image, error) {
	// TODO: 接入 AWS SDK
	return []Image{
		{ID: "ami-0c55b159cbfafe1f0", Name: "Amazon Linux 2", OS: "Amazon Linux"},
		{ID: "ami-0747bdcabd34c712a", Name: "Ubuntu 22.04 LTS", OS: "Ubuntu"},
		{ID: "ami-0b0dcb5067f052a63", Name: "CentOS 7", OS: "CentOS"},
	}, nil
}

func (p *AWSProvider) CreateInstance(req CreateInstanceRequest) (*Instance, error) {
	// TODO: 接入 AWS EC2 SDK 创建实例
	return nil, fmt.Errorf("aws CreateInstance not implemented: please integrate aws-sdk-go-v2")
}

func (p *AWSProvider) StartInstance(instanceID string) error {
	// TODO: 接入 AWS EC2 SDK
	return fmt.Errorf("aws StartInstance not implemented")
}

func (p *AWSProvider) StopInstance(instanceID string) error {
	// TODO: 接入 AWS EC2 SDK
	return fmt.Errorf("aws StopInstance not implemented")
}

func (p *AWSProvider) TerminateInstance(instanceID string) error {
	// TODO: 接入 AWS EC2 SDK
	return fmt.Errorf("aws TerminateInstance not implemented")
}

func (p *AWSProvider) GetInstanceStatus(instanceID string) (string, error) {
	// TODO: 接入 AWS EC2 SDK
	return "unknown", fmt.Errorf("aws GetInstanceStatus not implemented")
}

func (p *AWSProvider) ListInstances(region string) ([]Instance, error) {
	// TODO: 接入 AWS EC2 SDK
	return nil, fmt.Errorf("aws ListInstances not implemented")
}
