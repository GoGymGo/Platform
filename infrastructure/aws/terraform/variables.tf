variable "account_id" {
  description = "Dedicated AWS member account that owns this GoGymGo environment."
  type        = string

  validation {
    condition     = can(regex("^[0-9]{12}$", var.account_id))
    error_message = "account_id must be a 12-digit AWS account ID."
  }
}

variable "environment" {
  description = "Isolated deployment environment. Staging and production must use different AWS accounts."
  type        = string

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be staging or production."
  }
}

variable "region" {
  description = "Canadian AWS region for all regional workload data."
  type        = string
  default     = "ca-central-1"

  validation {
    condition     = var.region == "ca-central-1"
    error_message = "GoGymGo workloads are currently restricted to ca-central-1."
  }
}

variable "name_prefix" {
  description = "Short lowercase prefix for GoGymGo resources."
  type        = string
  default     = "gogymgo"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{1,11}$", var.name_prefix))
    error_message = "name_prefix must be 2-12 lowercase letters, digits, or hyphens."
  }
}

variable "github_repository" {
  description = "GitHub owner/repository allowed to assume the deployment role."
  type        = string
  default     = "GoGymGo/Platform"

  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.github_repository))
    error_message = "github_repository must use owner/repository syntax."
  }
}

variable "github_repository_owner_id" {
  description = "Immutable GitHub owner ID included in the deployment OIDC subject."
  type        = string
  default     = "275516911"

  validation {
    condition     = can(regex("^[1-9][0-9]*$", var.github_repository_owner_id))
    error_message = "github_repository_owner_id must be a positive numeric GitHub owner ID."
  }
}

variable "github_repository_id" {
  description = "Immutable GitHub repository ID included in the deployment OIDC subject."
  type        = string
  default     = "1294409363"

  validation {
    condition     = can(regex("^[1-9][0-9]*$", var.github_repository_id))
    error_message = "github_repository_id must be a positive numeric GitHub repository ID."
  }
}

variable "container_image" {
  description = "Bootstrap ECR image pinned to an immutable sha256 digest."
  type        = string

  validation {
    condition     = can(regex("^[0-9]{12}\\.dkr\\.ecr\\.ca-central-1\\.amazonaws\\.com/[a-z0-9/_-]+@sha256:[0-9a-f]{64}$", var.container_image))
    error_message = "container_image must be a ca-central-1 ECR image pinned to a lowercase sha256 digest."
  }

  validation {
    condition     = startswith(var.container_image, "${var.account_id}.dkr.ecr.${var.region}.amazonaws.com/")
    error_message = "container_image must come from ECR in this environment's dedicated AWS account."
  }
}

variable "firebase_project_id" {
  description = "Existing environment-specific Firebase project used for member authentication."
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.firebase_project_id))
    error_message = "firebase_project_id must be a valid Firebase project ID."
  }
}

variable "cors_origins" {
  description = "Exact HTTPS web origins allowed to call the API."
  type        = list(string)

  validation {
    condition = alltrue([
      for origin in var.cors_origins : can(regex("^https://[^,]+$", origin))
    ])
    error_message = "Every CORS origin must be an exact HTTPS origin."
  }

  validation {
    condition     = contains(var.cors_origins, "https://${var.member_web_domain}")
    error_message = "cors_origins must include the configured member-web origin."
  }
}

variable "api_certificate_arn" {
  description = "Issued ACM certificate ARN for the API listener. Leave null until Cloudflare DNS validation is approved and complete."
  type        = string
  default     = null
  nullable    = true

  validation {
    condition     = var.api_certificate_arn == null || can(regex("^arn:aws:acm:ca-central-1:[0-9]{12}:certificate/[0-9a-f-]+$", var.api_certificate_arn))
    error_message = "api_certificate_arn must be a ca-central-1 ACM certificate ARN."
  }
}

variable "api_domain" {
  description = "Public API hostname used by monitoring and release verification."
  type        = string
  default     = null
  nullable    = true

  validation {
    condition     = var.api_domain == null || can(regex("^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$", var.api_domain))
    error_message = "api_domain must be a valid lowercase DNS hostname."
  }
}

variable "member_web_domain" {
  description = "Public hostname for the browser member app. CloudFront uses its default hostname until a certificate is supplied."
  type        = string
  default     = "app.gogymgo.com"

  validation {
    condition     = can(regex("^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$", var.member_web_domain))
    error_message = "member_web_domain must be a valid lowercase DNS hostname."
  }
}

variable "member_web_certificate_arn" {
  description = "Issued us-east-1 ACM certificate ARN for the CloudFront member-app hostname. Leave null until DNS validation is complete."
  type        = string
  default     = null
  nullable    = true

  validation {
    condition     = var.member_web_certificate_arn == null || can(regex("^arn:aws:acm:us-east-1:${var.account_id}:certificate/[0-9a-f-]+$", var.member_web_certificate_arn))
    error_message = "member_web_certificate_arn must be a us-east-1 ACM certificate ARN in this environment's dedicated AWS account."
  }
}

variable "vpc_cidr" {
  description = "Dedicated VPC CIDR for this account and environment."
  type        = string
  default     = "10.20.0.0/16"
}

variable "database_instance_class" {
  description = "RDS PostgreSQL instance class."
  type        = string
  default     = "db.t4g.micro"

  validation {
    condition     = contains(["db.t4g.micro", "db.t4g.small", "db.t4g.medium"], var.database_instance_class)
    error_message = "database_instance_class must be an approved Graviton burstable class."
  }
}

variable "database_multi_az" {
  description = "Enable a synchronous Multi-AZ standby after the production HA gate is approved."
  type        = bool
  default     = false
}

variable "database_storage_gb" {
  description = "Initial encrypted gp3 database storage."
  type        = number
  default     = 20

  validation {
    condition     = floor(var.database_storage_gb) == var.database_storage_gb && var.database_storage_gb >= 20 && var.database_storage_gb <= 200
    error_message = "database_storage_gb must be a whole number between 20 and 200."
  }
}

variable "api_cpu" {
  description = "Fargate CPU units for the API task."
  type        = number
  default     = 512
}

variable "api_memory" {
  description = "Fargate memory MiB for the API task."
  type        = number
  default     = 1024
}

variable "api_desired_count" {
  description = "Bootstrap API tasks. The protected deployment workflow scales an approved release to one."
  type        = number
  default     = 0

  validation {
    condition     = floor(var.api_desired_count) == var.api_desired_count && var.api_desired_count >= 0 && var.api_desired_count <= 4
    error_message = "api_desired_count must be a whole number between 0 and 4."
  }
}

variable "worker_cpu" {
  description = "Fargate CPU units for the operations worker."
  type        = number
  default     = 256
}

variable "worker_memory" {
  description = "Fargate memory MiB for the operations worker."
  type        = number
  default     = 512
}

variable "worker_desired_count" {
  description = "Bootstrap worker tasks. Operations heartbeat ownership requires a singleton worker."
  type        = number
  default     = 0

  validation {
    condition     = floor(var.worker_desired_count) == var.worker_desired_count && var.worker_desired_count >= 0 && var.worker_desired_count <= 1
    error_message = "worker_desired_count must be zero or one."
  }
}

variable "creator_features_enabled" {
  description = "Enable creator application/configuration routes only after the product and operations gates pass."
  type        = bool
  default     = false
}

variable "landing_intake_enabled" {
  description = "Enable authenticated landing-intake forwarding only after the PostgreSQL cutover gate passes."
  type        = bool
  default     = false
}

variable "landing_intake_retention_days" {
  description = "Approved landing-intake retention period; required by the API when landing intake is enabled."
  type        = number
  default     = null
  nullable    = true

  validation {
    condition     = var.landing_intake_retention_days == null || (floor(var.landing_intake_retention_days) == var.landing_intake_retention_days && var.landing_intake_retention_days >= 30 && var.landing_intake_retention_days <= 730)
    error_message = "landing_intake_retention_days must be null or a whole number between 30 and 730."
  }
}

variable "partner_application_retention_days" {
  description = "Approved public partner-application retention period; null keeps public intake unavailable."
  type        = number
  default     = null
  nullable    = true

  validation {
    condition     = var.partner_application_retention_days == null || (floor(var.partner_application_retention_days) == var.partner_application_retention_days && var.partner_application_retention_days >= 30 && var.partner_application_retention_days <= 730)
    error_message = "partner_application_retention_days must be null or a whole number between 30 and 730."
  }
}

variable "log_retention_days" {
  description = "CloudWatch application-log retention."
  type        = number
  default     = 30

  validation {
    condition     = contains([14, 30, 60, 90, 120, 180, 365], var.log_retention_days)
    error_message = "log_retention_days must be an approved CloudWatch retention value."
  }
}

variable "monthly_budget_usd" {
  description = "Per-account monthly AWS budget in US dollars."
  type        = number
  default     = 120

  validation {
    condition     = var.monthly_budget_usd >= 10 && var.monthly_budget_usd <= 1000
    error_message = "monthly_budget_usd must be between 10 and 1000."
  }
}

variable "budget_notification_email" {
  description = "Optional email for gross-cost actual and forecast budget notifications."
  type        = string
  default     = null
  nullable    = true

  validation {
    condition     = var.budget_notification_email == null || can(regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", var.budget_notification_email))
    error_message = "budget_notification_email must be a valid email address."
  }
}

variable "alarm_notification_topic_arns" {
  description = "Reviewed SNS topic ARNs that receive application and infrastructure alarm transitions."
  type        = list(string)
  default     = []

  validation {
    condition = alltrue([
      for arn in var.alarm_notification_topic_arns : can(regex("^arn:aws:sns:ca-central-1:[0-9]{12}:[A-Za-z0-9_-]{1,256}$", arn))
    ])
    error_message = "Every alarm notification destination must be a ca-central-1 SNS topic ARN."
  }
}

variable "privacy_operations_enabled" {
  description = "Enable privacy export and erasure processing only after UAT."
  type        = bool
  default     = false
}

variable "profile_media_enabled" {
  description = "Enable private avatar media only after S3 signing UAT."
  type        = bool
  default     = false
}

variable "push_notifications_enabled" {
  description = "Enable Expo push delivery only after secret and delivery UAT."
  type        = bool
  default     = false
}

variable "deletion_protection" {
  description = "Protect persistent production data from Terraform deletion."
  type        = bool
  default     = true
}
