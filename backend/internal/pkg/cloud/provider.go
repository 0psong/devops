package cloud

// CloudProvider 统一云操作接口
type CloudProvider interface {
	ValidateCredentials() error
	ListRegions() ([]Region, error)
	ListZones(region string) ([]Zone, error)
	ListInstanceTypes(region string) ([]InstanceTypeInfo, error)
	ListImages(region string) ([]Image, error)
	CreateInstance(req CreateInstanceRequest) (*Instance, error)
	StartInstance(instanceID string) error
	StopInstance(instanceID string) error
	TerminateInstance(instanceID string) error
	GetInstanceStatus(instanceID string) (string, error)
	ListInstances(region string) ([]Instance, error)
}

type Region struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type Zone struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	RegionID string `json:"region_id"`
}

type InstanceTypeInfo struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	CPU    int    `json:"cpu"`
	Memory int    `json:"memory"` // MB
}

type Image struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	OS   string `json:"os"`
}

type CreateInstanceRequest struct {
	Name         string `json:"name"`
	Region       string `json:"region"`
	Zone         string `json:"zone"`
	InstanceType string `json:"instance_type"`
	ImageID      string `json:"image_id"`
	ChargeType   string `json:"charge_type"` // PostPaid, PrePaid
}

type Instance struct {
	InstanceID   string `json:"instance_id"`
	Name         string `json:"name"`
	Status       string `json:"status"`
	PublicIP     string `json:"public_ip"`
	PrivateIP    string `json:"private_ip"`
	CPU          int    `json:"cpu"`
	Memory       int    `json:"memory"`
	InstanceType string `json:"instance_type"`
	Region       string `json:"region"`
	Zone         string `json:"zone"`
}
