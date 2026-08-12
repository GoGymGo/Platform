locals {
  name         = "${var.name_prefix}-${var.environment}"
  otel_enabled = var.otel_exporter_otlp_endpoint != null

  labels = {
    application = "gogymgo"
    environment = var.environment
    managed_by  = "terraform"
  }

  runtime_secret_ids = {
    DATABASE_URL                 = "${local.name}-database-url"
    EXPO_PUSH_ACCESS_TOKEN       = "${local.name}-expo-push-access-token"
    GOGYMGO_OWNER_EMAIL          = "${local.name}-owner-email"
    PRIVACY_PSEUDONYMIZATION_KEY = "${local.name}-privacy-pseudonymization-key"
    REWARD_CODE_ENCRYPTION_KEY   = "${local.name}-reward-code-encryption-key"
  }

  common_environment = merge(
    {
      CORS_ORIGINS                     = join(",", var.cors_origins)
      DATABASE_POOL_MAX                = "10"
      FIREBASE_PROJECT_ID              = var.project_id
      PRIVATE_CONTENT_BUCKET           = google_storage_bucket.user_content.name
      PRIVATE_OBJECT_STORAGE_PROVIDER  = "google-cloud"
      LOG_LEVEL                        = var.log_level
      NODE_ENV                         = "production"
      OPENAPI_ENABLED                  = "false"
      OTEL_ENABLED                     = tostring(local.otel_enabled)
      PROFILE_MEDIA_ENABLED            = tostring(var.profile_media_enabled)
      PROFILE_MEDIA_MAX_BYTES          = "2097152"
      PROFILE_MEDIA_READ_TTL_SECONDS   = "300"
      PROFILE_MEDIA_UPLOAD_TTL_SECONDS = "300"
      PRIVACY_DOWNLOAD_URL_TTL_SECONDS = "300"
      PRIVACY_EXPORT_BUCKET            = google_storage_bucket.privacy_exports.name
      PRIVACY_EXPORT_RETENTION_DAYS    = "7"
      PRIVACY_JOB_LEASE_SECONDS        = "600"
      PRIVACY_OPERATIONS_ENABLED       = tostring(var.privacy_operations_enabled)
      PUSH_NOTIFICATIONS_ENABLED       = tostring(var.push_notifications_enabled)
      RATE_LIMIT_MAX                   = "120"
      RATE_LIMIT_TTL_MS                = "60000"
      TRUST_PROXY                      = "true"
      WORKER_HEARTBEAT_INTERVAL_MS     = "30000"
      WORKER_POLL_INTERVAL_MS          = "5000"
      WORKER_STALE_AFTER_MS            = "120000"
    },
    local.otel_enabled ? {
      OTEL_EXPORTER_OTLP_ENDPOINT = var.otel_exporter_otlp_endpoint
    } : {},
  )

  api_environment = merge(local.common_environment, {
    OTEL_SERVICE_NAME = "${local.name}-api"
    RUNTIME_ROLE      = "api"
  })

  worker_environment = merge(local.common_environment, {
    OTEL_SERVICE_NAME = "${local.name}-worker"
    RUNTIME_ROLE      = "worker"
  })

  api_secret_environment = {
    DATABASE_URL               = local.runtime_secret_ids.DATABASE_URL
    GOGYMGO_OWNER_EMAIL        = local.runtime_secret_ids.GOGYMGO_OWNER_EMAIL
    REWARD_CODE_ENCRYPTION_KEY = local.runtime_secret_ids.REWARD_CODE_ENCRYPTION_KEY
  }

  worker_secret_environment = merge(
    { DATABASE_URL = local.runtime_secret_ids.DATABASE_URL },
    var.privacy_operations_enabled ? {
      PRIVACY_PSEUDONYMIZATION_KEY = local.runtime_secret_ids.PRIVACY_PSEUDONYMIZATION_KEY
    } : {},
    var.push_notifications_enabled ? {
      EXPO_PUSH_ACCESS_TOKEN = local.runtime_secret_ids.EXPO_PUSH_ACCESS_TOKEN
    } : {},
  )
}
