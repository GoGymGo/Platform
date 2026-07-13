mock_provider "google" {
  mock_data "google_project" {
    defaults = {
      number     = "123456789012"
      project_id = "gogymgo-test-project"
    }
  }

  mock_resource "google_cloud_run_v2_service" {
    defaults = {
      uri = "https://gogymgo-staging-api.example.run.app"
    }
  }
}

mock_provider "google-beta" {}

variables {
  project_id      = "gogymgo-test-project"
  environment     = "staging"
  container_image = "northamerica-northeast1-docker.pkg.dev/gogymgo-test-project/gogymgo-backend/api@sha256:0000000000000000000000000000000000000000000000000000000000000000"
  cors_origins    = ["https://staging.example.com"]
}

run "safe_foundation_defaults" {
  command = plan

  assert {
    condition     = google_sql_database_instance.main.settings[0].ip_configuration[0].ipv4_enabled == false
    error_message = "Cloud SQL must never expose a public IPv4 address."
  }

  assert {
    condition     = google_sql_database_instance.main.settings[0].backup_configuration[0].point_in_time_recovery_enabled
    error_message = "Point-in-time recovery must remain enabled."
  }

  assert {
    condition     = google_storage_bucket.privacy_exports.public_access_prevention == "enforced"
    error_message = "Privacy exports must prevent public bucket access."
  }

  assert {
    condition     = google_cloud_run_v2_worker_pool.operations.scaling[0].scaling_mode == "MANUAL" && google_cloud_run_v2_worker_pool.operations.scaling[0].manual_instance_count == 1
    error_message = "The operations worker must start with one continuously running instance."
  }

  assert {
    condition     = length(google_secret_manager_secret_iam_member.api) == 1 && length(google_secret_manager_secret_iam_member.worker) == 1
    error_message = "Disabled features must not grant access to their unused secrets."
  }

  assert {
    condition     = length(google_storage_bucket_iam_member.api_content_creator) == 0 && length(google_storage_bucket_iam_member.api_content_viewer) == 0
    error_message = "Disabled profile media must not grant content-bucket access to the API."
  }

  assert {
    condition     = google_cloud_run_v2_service_iam_member.public_api.member == "allUsers"
    error_message = "The mobile API and Hyperwallet webhook ingress require public Cloud Run invocation; application authentication remains mandatory."
  }
}

run "feature_gates_mount_only_enabled_secrets" {
  command = plan

  variables {
    hyperwallet_enabled         = true
    hyperwallet_api_url         = "https://uat-api.paylution.com/rest/v4"
    hyperwallet_portal_url      = "https://payee.example.com"
    privacy_operations_enabled  = true
    profile_media_enabled       = true
    push_notifications_enabled  = true
    otel_exporter_otlp_endpoint = "https://otel.example.com"
  }

  assert {
    condition     = length(google_secret_manager_secret_iam_member.api) == 6 && length(google_secret_manager_secret_iam_member.worker) == 6
    error_message = "Enabled providers must mount only the secrets required by each runtime."
  }

  assert {
    condition     = length(google_storage_bucket_iam_member.api_content_creator) == 1 && length(google_storage_bucket_iam_member.api_content_viewer) == 1
    error_message = "Profile media must grant the API only create and read access to avatar objects."
  }

  assert {
    condition     = !contains(keys(local.api_secret_environment), "PRIVACY_PSEUDONYMIZATION_KEY") && !contains(keys(local.api_secret_environment), "EXPO_PUSH_ACCESS_TOKEN") && !contains(keys(local.worker_secret_environment), "HYPERWALLET_WEBHOOK_USERNAME") && !contains(keys(local.worker_secret_environment), "HYPERWALLET_WEBHOOK_PASSWORD")
    error_message = "API-only and worker-only secrets must remain isolated."
  }

  assert {
    condition     = local.api_environment.RUNTIME_ROLE == "api" && local.worker_environment.RUNTIME_ROLE == "worker" && local.api_environment.HYPERWALLET_ENABLED == "true" && local.api_environment.PRIVACY_OPERATIONS_ENABLED == "true" && local.api_environment.PROFILE_MEDIA_ENABLED == "true" && local.api_environment.PUSH_NOTIFICATIONS_ENABLED == "true" && local.api_environment.OTEL_ENABLED == "true"
    error_message = "Feature flags must reach the workload environment explicitly."
  }
}
