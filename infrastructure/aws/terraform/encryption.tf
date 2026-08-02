resource "aws_kms_key" "data" {
  description             = "GoGymGo ${var.environment} application data"
  deletion_window_in_days = var.environment == "production" ? 30 : 7
  enable_key_rotation     = true
}

resource "aws_kms_alias" "data" {
  name          = "alias/${local.name}-data"
  target_key_id = aws_kms_key.data.key_id
}
