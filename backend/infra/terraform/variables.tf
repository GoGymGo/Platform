variable "project_id" {
  description = "Google Cloud project that owns this isolated environment."
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.project_id))
    error_message = "project_id must be a valid Google Cloud project ID."
  }
}

variable "environment" {
  description = "Deployment environment encoded into resource names and labels."
  type        = string

  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "environment must be development, staging, or production."
  }

  validation {
    condition     = length("${var.name_prefix}-${var.environment}-migration") <= 30
    error_message = "name_prefix and environment together must fit Google service-account ID limits."
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

variable "region" {
  description = "Primary Google Cloud region; keep Cloud Run and Cloud SQL colocated."
  type        = string
  default     = "northamerica-northeast1"

  validation {
    condition     = can(regex("^[a-z]+(?:-[a-z]+)+[0-9]$", var.region))
    error_message = "region must be a Google Cloud region identifier."
  }
}

variable "container_image" {
  description = "Immutable Artifact Registry image reference shared by API, worker, and migration workloads."
  type        = string

  validation {
    condition     = can(regex("@sha256:[0-9a-f]{64}$", var.container_image))
    error_message = "container_image must be pinned to an immutable sha256 digest."
  }

  validation {
    condition     = startswith(var.container_image, "${var.region}-docker.pkg.dev/${var.project_id}/")
    error_message = "container_image must come from Artifact Registry in this environment's project and region."
  }
}

variable "cors_origins" {
  description = "Exact HTTPS web origins allowed to call the API; native clients do not require CORS entries."
  type        = list(string)

  validation {
    condition = alltrue([
      for origin in var.cors_origins : can(regex("^https://[^,]+$", origin))
    ])
    error_message = "Every production CORS origin must be an exact HTTPS origin."
  }
}

variable "log_level" {
  description = "Structured application log threshold."
  type        = string
  default     = "info"

  validation {
    condition     = contains(["fatal", "error", "warn", "info", "debug", "trace"], var.log_level)
    error_message = "log_level is not supported by the backend logger."
  }
}

variable "deletion_protection" {
  description = "Prevent Terraform from deleting persistent and runtime resources."
  type        = bool
  default     = true
}

variable "run_subnet_cidr" {
  description = "CIDR allocated to direct Cloud Run VPC egress."
  type        = string
  default     = "10.20.0.0/24"
}

variable "private_service_prefix_length" {
  description = "Prefix length reserved for Google private service access."
  type        = number
  default     = 16

  validation {
    condition     = floor(var.private_service_prefix_length) == var.private_service_prefix_length && var.private_service_prefix_length >= 16 && var.private_service_prefix_length <= 24
    error_message = "private_service_prefix_length must be a whole number between 16 and 24."
  }
}

variable "database_name" {
  description = "Application database created inside the managed PostgreSQL instance."
  type        = string
  default     = "gogymgo"

  validation {
    condition     = can(regex("^[a-z][a-z0-9_]{0,62}$", var.database_name))
    error_message = "database_name must be a safe PostgreSQL identifier."
  }
}

variable "database_tier" {
  description = "Cloud SQL machine tier."
  type        = string
  default     = "db-custom-2-7680"
}

variable "database_disk_size_gb" {
  description = "Initial SSD size; automatic growth remains enabled."
  type        = number
  default     = 50

  validation {
    condition     = floor(var.database_disk_size_gb) == var.database_disk_size_gb && var.database_disk_size_gb >= 10
    error_message = "database_disk_size_gb must be a whole number of at least 10 GB."
  }
}

variable "database_ha_enabled" {
  description = "Use a regional highly available Cloud SQL instance."
  type        = bool
  default     = true
}

variable "api_min_instances" {
  description = "Minimum warm API instances."
  type        = number
  default     = 1

  validation {
    condition     = floor(var.api_min_instances) == var.api_min_instances && var.api_min_instances >= 0
    error_message = "api_min_instances must be a non-negative whole number."
  }
}

variable "api_max_instances" {
  description = "Maximum API instances, bounding database connections and cost."
  type        = number
  default     = 20

  validation {
    condition     = floor(var.api_max_instances) == var.api_max_instances && var.api_max_instances >= max(1, var.api_min_instances)
    error_message = "api_max_instances must be a whole number greater than or equal to api_min_instances."
  }
}

variable "api_cpu" {
  description = "CPU limit for each API instance."
  type        = string
  default     = "1"
}

variable "api_memory" {
  description = "Memory limit for each API instance."
  type        = string
  default     = "512Mi"
}

variable "worker_instances" {
  description = "Continuously running operations-worker instances. Keep at one until concurrent polling is load tested."
  type        = number
  default     = 1

  validation {
    condition     = floor(var.worker_instances) == var.worker_instances && var.worker_instances >= 1 && var.worker_instances <= 10
    error_message = "worker_instances must be a whole number between 1 and 10."
  }
}

variable "worker_cpu" {
  description = "CPU limit for each worker instance."
  type        = string
  default     = "1"
}

variable "worker_memory" {
  description = "Memory limit for each worker instance."
  type        = string
  default     = "512Mi"
}

variable "privacy_operations_enabled" {
  description = "Enable audited privacy export and erasure processing after IAM/UAT sign-off."
  type        = bool
  default     = false
}

variable "profile_media_enabled" {
  description = "Enable private avatar upload, moderation, and cleanup operations."
  type        = bool
  default     = false
}

variable "push_notifications_enabled" {
  description = "Enable Expo push delivery after the access-token secret is populated."
  type        = bool
  default     = false
}

variable "otel_exporter_otlp_endpoint" {
  description = "Optional HTTPS OTLP collector endpoint; leaving it null disables application export."
  type        = string
  default     = null
  nullable    = true

  validation {
    condition     = var.otel_exporter_otlp_endpoint == null || can(regex("^https://", var.otel_exporter_otlp_endpoint))
    error_message = "otel_exporter_otlp_endpoint must be HTTPS when configured."
  }
}

variable "monitoring_notification_channels" {
  description = "Existing Cloud Monitoring notification-channel resource names."
  type        = list(string)
  default     = []

  validation {
    condition = alltrue([
      for channel in var.monitoring_notification_channels : can(regex("^projects/[^/]+/notificationChannels/[^/]+$", channel))
    ])
    error_message = "Every notification channel must be a full Cloud Monitoring channel resource name."
  }
}
