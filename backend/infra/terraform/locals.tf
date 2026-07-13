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
    HYPERWALLET_PASSWORD         = "${local.name}-hyperwallet-password"
    HYPERWALLET_PROGRAM_TOKEN    = "${local.name}-hyperwallet-program-token"
    HYPERWALLET_USERNAME         = "${local.name}-hyperwallet-username"
    HYPERWALLET_WEBHOOK_PASSWORD = "${local.name}-hyperwallet-webhook-password"
    HYPERWALLET_WEBHOOK_USERNAME = "${local.name}-hyperwallet-webhook-username"
    PRIVACY_PSEUDONYMIZATION_KEY = "${local.name}-privacy-pseudonymization-key"
  }

  common_environment = merge(
    {
      AUTH_MODE                        = "firebase"
      CORS_ORIGINS                     = join(",", var.cors_origins)
      DATABASE_POOL_MAX                = "10"
      FIREBASE_PROJECT_ID              = var.project_id
      GCP_STORAGE_BUCKET               = google_storage_bucket.user_content.name
      HYPERWALLET_ENABLED              = tostring(var.hyperwallet_enabled)
      LOG_LEVEL                        = var.log_level
      NODE_ENV                         = "production"
      OPENAPI_ENABLED                  = "false"
      OTEL_ENABLED                     = tostring(local.otel_enabled)
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
    var.hyperwallet_enabled ? {
      HYPERWALLET_API_URL    = var.hyperwallet_api_url
      HYPERWALLET_PORTAL_URL = var.hyperwallet_portal_url
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

  hyperwallet_common_secret_environment = var.hyperwallet_enabled ? {
    HYPERWALLET_PASSWORD      = local.runtime_secret_ids.HYPERWALLET_PASSWORD
    HYPERWALLET_PROGRAM_TOKEN = local.runtime_secret_ids.HYPERWALLET_PROGRAM_TOKEN
    HYPERWALLET_USERNAME      = local.runtime_secret_ids.HYPERWALLET_USERNAME
  } : {}

  api_secret_environment = merge(
    { DATABASE_URL = local.runtime_secret_ids.DATABASE_URL },
    local.hyperwallet_common_secret_environment,
    var.hyperwallet_enabled ? {
      HYPERWALLET_WEBHOOK_PASSWORD = local.runtime_secret_ids.HYPERWALLET_WEBHOOK_PASSWORD
      HYPERWALLET_WEBHOOK_USERNAME = local.runtime_secret_ids.HYPERWALLET_WEBHOOK_USERNAME
    } : {},
  )

  worker_secret_environment = merge(
    { DATABASE_URL = local.runtime_secret_ids.DATABASE_URL },
    local.hyperwallet_common_secret_environment,
    var.privacy_operations_enabled ? {
      PRIVACY_PSEUDONYMIZATION_KEY = local.runtime_secret_ids.PRIVACY_PSEUDONYMIZATION_KEY
    } : {},
    var.push_notifications_enabled ? {
      EXPO_PUSH_ACCESS_TOKEN = local.runtime_secret_ids.EXPO_PUSH_ACCESS_TOKEN
    } : {},
  )
}
