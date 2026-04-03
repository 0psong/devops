package cloud

import "fmt"

// NewProvider 根据提供商类型创建对应的 CloudProvider
func NewProvider(provider, accessKey, secretKey, region string) (CloudProvider, error) {
	switch provider {
	case "alicloud":
		return NewAliCloudProvider(accessKey, secretKey, region), nil
	case "aws":
		return NewAWSProvider(accessKey, secretKey, region), nil
	default:
		return nil, fmt.Errorf("unsupported cloud provider: %s", provider)
	}
}
