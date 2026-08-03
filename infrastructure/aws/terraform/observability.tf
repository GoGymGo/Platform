resource "aws_cloudwatch_log_group" "application" {
  kms_key_id        = aws_kms_key.data.arn
  name              = "/gogymgo/${var.environment}/application"
  retention_in_days = var.log_retention_days

  lifecycle { prevent_destroy = true }
}

resource "aws_cloudwatch_log_metric_filter" "api_errors" {
  log_group_name = aws_cloudwatch_log_group.application.name
  name           = "${local.name}-api-errors"
  pattern        = "{ $.event = \"api.request.failed\" && $.statusCode >= 500 }"

  metric_transformation {
    name      = "ApiServerErrors"
    namespace = "GoGymGo/${var.environment}"
    value     = "1"
  }
}

resource "aws_cloudwatch_log_metric_filter" "worker_failures" {
  log_group_name = aws_cloudwatch_log_group.application.name
  name           = "${local.name}-worker-failures"
  pattern        = "{ $.event = \"worker.batch.failed\" }"

  metric_transformation {
    name      = "WorkerBatchFailures"
    namespace = "GoGymGo/${var.environment}"
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "api_errors" {
  alarm_description   = "GoGymGo API emitted at least one server error in five minutes."
  alarm_name          = "${local.name}-api-server-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApiServerErrors"
  namespace           = "GoGymGo/${var.environment}"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"
}

resource "aws_cloudwatch_metric_alarm" "worker_failures" {
  alarm_description   = "GoGymGo worker emitted at least one batch failure in five minutes."
  alarm_name          = "${local.name}-worker-batch-failures"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "WorkerBatchFailures"
  namespace           = "GoGymGo/${var.environment}"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"
}

resource "aws_cloudwatch_metric_alarm" "database_cpu" {
  alarm_description   = "GoGymGo RDS CPU remained above 80 percent."
  alarm_name          = "${local.name}-database-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  dimensions          = { DBInstanceIdentifier = aws_db_instance.main.identifier }
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  treat_missing_data  = "missing"
}

resource "aws_cloudwatch_metric_alarm" "database_storage" {
  alarm_description   = "GoGymGo RDS free storage dropped below 5 GiB."
  alarm_name          = "${local.name}-database-low-storage"
  comparison_operator = "LessThanThreshold"
  dimensions          = { DBInstanceIdentifier = aws_db_instance.main.identifier }
  evaluation_periods  = 1
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 5368709120
  treat_missing_data  = "missing"
}

resource "aws_cloudwatch_metric_alarm" "unhealthy_targets" {
  alarm_description   = "The public API has an unhealthy target."
  alarm_name          = "${local.name}-unhealthy-api-targets"
  comparison_operator = "GreaterThanThreshold"
  dimensions = {
    LoadBalancer = aws_lb.api.arn_suffix
    TargetGroup  = aws_lb_target_group.api.arn_suffix
  }
  evaluation_periods = 2
  metric_name        = "UnHealthyHostCount"
  namespace          = "AWS/ApplicationELB"
  period             = 60
  statistic          = "Maximum"
  threshold          = 0
  treat_missing_data = var.api_desired_count == 0 ? "notBreaching" : "breaching"
}

resource "aws_budgets_budget" "monthly" {
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_usd)
  limit_unit   = "USD"
  name         = "${local.name}-monthly"
  time_unit    = "MONTHLY"

  # Measure gross service usage before promotional credits are applied. If
  # credits were included, a healthy shared-credit balance could suppress the
  # budget even while the environment's underlying run rate increased.
  cost_types {
    include_credit = false
    include_refund = false
  }

  dynamic "notification" {
    for_each = var.budget_notification_email == null ? [] : [
      { type = "ACTUAL", threshold = 25 },
      { type = "ACTUAL", threshold = 50 },
      { type = "ACTUAL", threshold = 80 },
      { type = "ACTUAL", threshold = 100 },
      { type = "FORECASTED", threshold = 100 },
    ]
    content {
      comparison_operator        = "GREATER_THAN"
      notification_type          = notification.value.type
      subscriber_email_addresses = [var.budget_notification_email]
      threshold                  = notification.value.threshold
      threshold_type             = "PERCENTAGE"
    }
  }
}
