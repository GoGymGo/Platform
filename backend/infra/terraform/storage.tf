resource "google_storage_bucket" "user_content" {
  project                     = var.project_id
  name                        = "${var.project_id}-${var.environment}-gogymgo-content"
  location                    = var.region
  force_destroy               = false
  public_access_prevention    = "enforced"
  uniform_bucket_level_access = true
  labels                      = local.labels

  cors {
    origin = var.cors_origins
    method = ["GET", "HEAD", "PUT"]
    response_header = [
      "Cache-Control",
      "Content-Type",
      "x-goog-content-length-range",
      "x-goog-if-generation-match",
      "x-goog-meta-media-id",
    ]
    max_age_seconds = 300
  }

  soft_delete_policy {
    retention_duration_seconds = 0
  }

  versioning {
    enabled = false
  }

  depends_on = [google_project_service.required]
}

resource "google_storage_bucket" "privacy_exports" {
  project                     = var.project_id
  name                        = "${var.project_id}-${var.environment}-gogymgo-privacy"
  location                    = var.region
  force_destroy               = false
  public_access_prevention    = "enforced"
  uniform_bucket_level_access = true
  labels                      = local.labels

  lifecycle_rule {
    action {
      type = "Delete"
    }
    condition {
      age = 7
    }
  }

  soft_delete_policy {
    retention_duration_seconds = 0
  }

  versioning {
    enabled = false
  }

  depends_on = [google_project_service.required]
}
