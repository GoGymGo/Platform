resource "aws_secretsmanager_secret" "runtime" {
  for_each = local.secret_names

  description             = "GoGymGo ${var.environment} runtime secret ${each.key}"
  kms_key_id              = aws_kms_key.data.arn
  name                    = each.value
  recovery_window_in_days = var.environment == "production" ? 30 : 7

  lifecycle {
    prevent_destroy = true
  }
}
