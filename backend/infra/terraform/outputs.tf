output "api_url" {
  description = "Public Cloud Run API URL."
  value       = google_cloud_run_v2_service.api.uri
}

output "artifact_repository" {
  description = "Artifact Registry repository that stores immutable backend images."
  value       = google_artifact_registry_repository.backend.name
}

output "cloud_sql_instance" {
  description = "Cloud SQL instance connection name for operator tooling."
  value       = google_sql_database_instance.main.connection_name
}

output "cloud_sql_private_ip" {
  description = "Private database IP used when assembling DATABASE_URL out of band."
  value       = google_sql_database_instance.main.private_ip_address
}

output "migration_job_name" {
  description = "Cloud Run job that applies the image's forward migrations."
  value       = google_cloud_run_v2_job.migration.name
}

output "runtime_secret_ids" {
  description = "Secret containers whose values must be populated outside Terraform."
  value       = local.runtime_secret_ids
}

output "worker_pool_name" {
  description = "Continuous Cloud Run worker pool."
  value       = google_cloud_run_v2_worker_pool.operations.name
}
