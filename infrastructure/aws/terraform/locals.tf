locals {
  name = "${var.name_prefix}-${var.environment}"

  github_repository_parts = split("/", var.github_repository)
  github_oidc_subject     = "repo:${local.github_repository_parts[0]}@${var.github_repository_owner_id}/${local.github_repository_parts[1]}@${var.github_repository_id}:environment:${var.environment}"

  tags = {
    Application = "GoGymGo"
    Environment = var.environment
    ManagedBy   = "Terraform"
    Project     = "GoGymGo"
  }

  availability_zones = slice(data.aws_availability_zones.available.names, 0, 2)

  secret_names = {
    DATABASE_URL                  = "${local.name}/database-url"
    EXPO_PUSH_ACCESS_TOKEN        = "${local.name}/expo-push-access-token"
    FIREBASE_SERVICE_ACCOUNT_JSON = "${local.name}/firebase-service-account-json"
    GOGYMGO_OWNER_EMAIL           = "${local.name}/owner-email"
    PRIVACY_PSEUDONYMIZATION_KEY  = "${local.name}/privacy-pseudonymization-key"
    REWARD_CODE_ENCRYPTION_KEY    = "${local.name}/reward-code-encryption-key"
  }

  common_environment = {
    AWS_REGION                       = var.region
    CORS_ORIGINS                     = join(",", var.cors_origins)
    DATABASE_POOL_MAX                = "10"
    FIREBASE_PROJECT_ID              = var.firebase_project_id
    LOG_LEVEL                        = "info"
    NODE_ENV                         = "production"
    OPENAPI_ENABLED                  = "false"
    OTEL_ENABLED                     = "false"
    PRETTY_LOGS_ENABLED              = "false"
    PRIVATE_CONTENT_BUCKET           = aws_s3_bucket.user_content.bucket
    PRIVATE_OBJECT_STORAGE_PROVIDER  = "aws-s3"
    PRIVACY_DOWNLOAD_URL_TTL_SECONDS = "300"
    PRIVACY_EXPORT_BUCKET            = aws_s3_bucket.privacy_exports.bucket
    PRIVACY_EXPORT_RETENTION_DAYS    = "7"
    PRIVACY_JOB_LEASE_SECONDS        = "600"
    PRIVACY_OPERATIONS_ENABLED       = tostring(var.privacy_operations_enabled)
    PROFILE_MEDIA_ENABLED            = tostring(var.profile_media_enabled)
    PROFILE_MEDIA_MAX_BYTES          = "2097152"
    PROFILE_MEDIA_READ_TTL_SECONDS   = "300"
    PROFILE_MEDIA_UPLOAD_TTL_SECONDS = "300"
    PUSH_NOTIFICATIONS_ENABLED       = tostring(var.push_notifications_enabled)
    RATE_LIMIT_MAX                   = "120"
    RATE_LIMIT_TTL_MS                = "60000"
    TRUST_PROXY                      = "true"
    WORKER_HEARTBEAT_INTERVAL_MS     = "30000"
    WORKER_POLL_INTERVAL_MS          = "5000"
    WORKER_STALE_AFTER_MS            = "120000"
  }

  api_environment = merge(local.common_environment, {
    OTEL_SERVICE_NAME = "${local.name}-api"
    RUNTIME_ROLE      = "api"
  })

  worker_environment = merge(local.common_environment, {
    OTEL_SERVICE_NAME = "${local.name}-worker"
    RUNTIME_ROLE      = "worker"
  })

  api_secret_environment = {
    DATABASE_URL                  = aws_secretsmanager_secret.runtime["DATABASE_URL"].arn
    FIREBASE_SERVICE_ACCOUNT_JSON = aws_secretsmanager_secret.runtime["FIREBASE_SERVICE_ACCOUNT_JSON"].arn
    GOGYMGO_OWNER_EMAIL           = aws_secretsmanager_secret.runtime["GOGYMGO_OWNER_EMAIL"].arn
    REWARD_CODE_ENCRYPTION_KEY    = aws_secretsmanager_secret.runtime["REWARD_CODE_ENCRYPTION_KEY"].arn
  }

  worker_secret_environment = merge(
    {
      DATABASE_URL                  = aws_secretsmanager_secret.runtime["DATABASE_URL"].arn
      FIREBASE_SERVICE_ACCOUNT_JSON = aws_secretsmanager_secret.runtime["FIREBASE_SERVICE_ACCOUNT_JSON"].arn
      REWARD_CODE_ENCRYPTION_KEY    = aws_secretsmanager_secret.runtime["REWARD_CODE_ENCRYPTION_KEY"].arn
    },
    var.privacy_operations_enabled ? {
      PRIVACY_PSEUDONYMIZATION_KEY = aws_secretsmanager_secret.runtime["PRIVACY_PSEUDONYMIZATION_KEY"].arn
    } : {},
    var.push_notifications_enabled ? {
      EXPO_PUSH_ACCESS_TOKEN = aws_secretsmanager_secret.runtime["EXPO_PUSH_ACCESS_TOKEN"].arn
    } : {},
  )
}
