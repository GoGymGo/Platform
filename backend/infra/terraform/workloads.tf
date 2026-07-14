resource "google_cloud_run_v2_service" "api" {
  project             = var.project_id
  name                = "${local.name}-api"
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = var.deletion_protection

  template {
    service_account                  = google_service_account.api.email
    timeout                          = "30s"
    max_instance_request_concurrency = 80

    scaling {
      min_instance_count = var.api_min_instances
      max_instance_count = var.api_max_instances
    }

    vpc_access {
      egress = "PRIVATE_RANGES_ONLY"
      network_interfaces {
        network    = google_compute_network.backend.name
        subnetwork = google_compute_subnetwork.run.name
      }
    }

    containers {
      image = var.container_image

      ports {
        name           = "http1"
        container_port = 3000
      }

      resources {
        cpu_idle          = true
        startup_cpu_boost = true
        limits = {
          cpu    = var.api_cpu
          memory = var.api_memory
        }
      }

      startup_probe {
        failure_threshold     = 10
        initial_delay_seconds = 0
        period_seconds        = 3
        timeout_seconds       = 3

        http_get {
          path = "/v1/health"
          port = 3000
        }
      }

      liveness_probe {
        failure_threshold     = 3
        initial_delay_seconds = 10
        period_seconds        = 30
        timeout_seconds       = 5

        http_get {
          path = "/v1/health"
          port = 3000
        }
      }

      dynamic "env" {
        for_each = local.api_environment
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = local.api_secret_environment
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.runtime[env.key].secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }

  depends_on = [
    google_firebase_project.current,
    google_project_service.required,
    google_secret_manager_secret_iam_member.api,
    google_service_account_iam_member.api_signing,
    google_service_networking_connection.private_services,
    google_sql_database.application,
    google_storage_bucket_iam_member.api_content_creator,
    google_storage_bucket_iam_member.api_content_viewer,
    google_storage_bucket_iam_member.api_privacy_reader,
  ]

  lifecycle {
    ignore_changes = [template[0].containers[0].image]
  }
}

resource "google_cloud_run_v2_service_iam_member" "public_api" {
  project  = var.project_id
  location = google_cloud_run_v2_service.api.location
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_worker_pool" "operations" {
  project             = var.project_id
  name                = "${local.name}-operations"
  location            = var.region
  deletion_protection = var.deletion_protection

  scaling {
    scaling_mode          = "MANUAL"
    manual_instance_count = var.worker_instances
  }

  template {
    service_account = google_service_account.worker.email

    vpc_access {
      egress = "PRIVATE_RANGES_ONLY"
      network_interfaces {
        network    = google_compute_network.backend.name
        subnetwork = google_compute_subnetwork.run.name
      }
    }

    containers {
      image   = var.container_image
      command = ["node"]
      args = [
        "--require",
        "./dist/observability/instrumentation.js",
        "dist/worker.js",
      ]

      resources {
        limits = {
          cpu    = var.worker_cpu
          memory = var.worker_memory
        }
      }

      dynamic "env" {
        for_each = local.worker_environment
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = local.worker_secret_environment
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.runtime[env.key].secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }

  depends_on = [
    google_firebase_project.current,
    google_project_iam_member.worker_firebase_admin,
    google_project_service.required,
    google_secret_manager_secret_iam_member.worker,
    google_service_networking_connection.private_services,
    google_sql_database.application,
    google_storage_bucket_iam_member.worker_content_admin,
    google_storage_bucket_iam_member.worker_privacy_admin,
  ]

  lifecycle {
    ignore_changes = [template[0].containers[0].image]
  }
}

resource "google_cloud_run_v2_job" "migration" {
  project             = var.project_id
  name                = "${local.name}-migration"
  location            = var.region
  deletion_protection = var.deletion_protection

  template {
    template {
      service_account = google_service_account.migration.email
      max_retries     = 0
      timeout         = "900s"

      vpc_access {
        egress = "PRIVATE_RANGES_ONLY"
        network_interfaces {
          network    = google_compute_network.backend.name
          subnetwork = google_compute_subnetwork.run.name
        }
      }

      containers {
        image   = var.container_image
        command = ["npm"]
        args    = ["run", "migrate:deploy"]

        resources {
          limits = {
            cpu    = "1"
            memory = "512Mi"
          }
        }

        env {
          name = "DATABASE_URL"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.runtime["DATABASE_URL"].secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }

  depends_on = [
    google_project_service.required,
    google_secret_manager_secret_iam_member.migration_database,
    google_service_networking_connection.private_services,
    google_sql_database.application,
  ]

  lifecycle {
    ignore_changes = [template[0].template[0].containers[0].image]
  }
}
