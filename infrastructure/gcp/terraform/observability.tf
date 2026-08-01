resource "google_logging_metric" "api_server_errors" {
  project = var.project_id
  name    = "${local.name}-api-server-errors"
  filter  = <<-EOT
    resource.type="cloud_run_revision"
    resource.labels.service_name="${google_cloud_run_v2_service.api.name}"
    jsonPayload.event="api.request.failed"
    jsonPayload.statusCode>=500
  EOT

  metric_descriptor {
    display_name = "GoGymGo API server errors"
    metric_kind  = "DELTA"
    value_type   = "INT64"
    unit         = "1"
  }
}

resource "google_logging_metric" "worker_batch_failures" {
  project = var.project_id
  name    = "${local.name}-worker-batch-failures"
  filter  = <<-EOT
    resource.type="cloud_run_worker_pool"
    resource.labels.worker_pool_name="${google_cloud_run_v2_worker_pool.operations.name}"
    jsonPayload.event="worker.batch.failed"
  EOT

  metric_descriptor {
    display_name = "GoGymGo worker batch failures"
    metric_kind  = "DELTA"
    value_type   = "INT64"
    unit         = "1"
  }
}

resource "google_monitoring_uptime_check_config" "readiness" {
  project      = var.project_id
  display_name = "${local.name} API and worker readiness"
  period       = "60s"
  timeout      = "10s"

  http_check {
    path           = "/v1/health/ready"
    port           = 443
    request_method = "GET"
    use_ssl        = true
    validate_ssl   = true
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      host       = trimprefix(google_cloud_run_v2_service.api.uri, "https://")
      project_id = var.project_id
    }
  }
}

resource "google_monitoring_alert_policy" "readiness" {
  project               = var.project_id
  display_name          = "${local.name}: API or worker not ready"
  combiner              = "OR"
  notification_channels = var.monitoring_notification_channels

  conditions {
    display_name = "Readiness checks below 80 percent"

    condition_threshold {
      filter = join(" AND ", [
        "metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\"",
        "resource.type=\"uptime_url\"",
        "metric.label.check_id=\"${google_monitoring_uptime_check_config.readiness.uptime_check_id}\"",
      ])
      comparison      = "COMPARISON_LT"
      duration        = "120s"
      threshold_value = 0.8

      aggregations {
        alignment_period     = "120s"
        cross_series_reducer = "REDUCE_MEAN"
        per_series_aligner   = "ALIGN_FRACTION_TRUE"
      }

      trigger {
        count = 1
      }
    }
  }

  alert_strategy {
    auto_close = "1800s"
  }

  documentation {
    mime_type = "text/markdown"
    content   = "The public readiness endpoint checks both PostgreSQL and the durable operations-worker heartbeat. Follow docs/operations/api-deployment.md before restarting or replaying work."
  }
}

resource "google_monitoring_alert_policy" "api_server_errors" {
  project               = var.project_id
  display_name          = "${local.name}: API server errors"
  combiner              = "OR"
  notification_channels = var.monitoring_notification_channels

  conditions {
    display_name = "At least one API server error in five minutes"

    condition_threshold {
      filter = join(" AND ", [
        "metric.type=\"logging.googleapis.com/user/${google_logging_metric.api_server_errors.name}\"",
        "resource.type=\"cloud_run_revision\"",
      ])
      comparison      = "COMPARISON_GT"
      duration        = "0s"
      threshold_value = 0

      aggregations {
        alignment_period     = "300s"
        cross_series_reducer = "REDUCE_SUM"
        per_series_aligner   = "ALIGN_RATE"
      }
    }
  }

  alert_strategy {
    auto_close = "1800s"
  }
}

resource "google_monitoring_alert_policy" "worker_batch_failures" {
  project               = var.project_id
  display_name          = "${local.name}: worker batch failures"
  combiner              = "OR"
  notification_channels = var.monitoring_notification_channels

  conditions {
    display_name = "At least one failed worker batch in five minutes"

    condition_threshold {
      filter = join(" AND ", [
        "metric.type=\"logging.googleapis.com/user/${google_logging_metric.worker_batch_failures.name}\"",
        "resource.type=\"cloud_run_worker_pool\"",
      ])
      comparison      = "COMPARISON_GT"
      duration        = "0s"
      threshold_value = 0

      aggregations {
        alignment_period     = "300s"
        cross_series_reducer = "REDUCE_SUM"
        per_series_aligner   = "ALIGN_RATE"
      }
    }
  }

  alert_strategy {
    auto_close = "1800s"
  }
}

resource "google_monitoring_alert_policy" "database_cpu" {
  project               = var.project_id
  display_name          = "${local.name}: Cloud SQL high CPU"
  combiner              = "OR"
  notification_channels = var.monitoring_notification_channels

  conditions {
    display_name = "Cloud SQL CPU above 80 percent for five minutes"

    condition_threshold {
      filter = join(" AND ", [
        "metric.type=\"cloudsql.googleapis.com/database/cpu/utilization\"",
        "resource.type=\"cloudsql_database\"",
        "resource.label.database_id=\"${var.project_id}:${google_sql_database_instance.main.name}\"",
      ])
      comparison      = "COMPARISON_GT"
      duration        = "300s"
      threshold_value = 0.8

      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  alert_strategy {
    auto_close = "1800s"
  }
}
