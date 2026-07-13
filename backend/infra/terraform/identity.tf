resource "google_service_account" "api" {
  project      = var.project_id
  account_id   = "${local.name}-api"
  display_name = "GoGymGo ${var.environment} API"
}

resource "google_service_account" "worker" {
  project      = var.project_id
  account_id   = "${local.name}-worker"
  display_name = "GoGymGo ${var.environment} operations worker"
}

resource "google_service_account" "migration" {
  project      = var.project_id
  account_id   = "${local.name}-migration"
  display_name = "GoGymGo ${var.environment} database migration job"
}

resource "google_project_iam_member" "worker_firebase_admin" {
  project = var.project_id
  role    = "roles/firebaseauth.admin"
  member  = "serviceAccount:${google_service_account.worker.email}"

  depends_on = [google_firebase_project.current]
}

resource "google_service_account_iam_member" "api_signing" {
  service_account_id = google_service_account.api.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${google_service_account.api.email}"
}

resource "google_storage_bucket_iam_member" "api_privacy_reader" {
  bucket = google_storage_bucket.privacy_exports.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.api.email}"
}

resource "google_storage_bucket_iam_member" "api_content_creator" {
  count  = var.profile_media_enabled ? 1 : 0
  bucket = google_storage_bucket.user_content.name
  role   = "roles/storage.objectCreator"
  member = "serviceAccount:${google_service_account.api.email}"

  condition {
    title      = "avatar_objects_only"
    expression = "resource.name.startsWith('projects/_/buckets/${google_storage_bucket.user_content.name}/objects/avatars/')"
  }
}

resource "google_storage_bucket_iam_member" "api_content_viewer" {
  count  = var.profile_media_enabled ? 1 : 0
  bucket = google_storage_bucket.user_content.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.api.email}"

  condition {
    title      = "avatar_objects_only"
    expression = "resource.name.startsWith('projects/_/buckets/${google_storage_bucket.user_content.name}/objects/avatars/')"
  }
}

resource "google_storage_bucket_iam_member" "worker_privacy_admin" {
  bucket = google_storage_bucket.privacy_exports.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.worker.email}"
}

resource "google_storage_bucket_iam_member" "worker_content_admin" {
  bucket = google_storage_bucket.user_content.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.worker.email}"
}
