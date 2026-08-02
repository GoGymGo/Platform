resource "aws_db_subnet_group" "main" {
  description = "Private database subnets for ${local.name}"
  name        = "${local.name}-database"
  subnet_ids  = aws_subnet.database[*].id
}

resource "aws_db_parameter_group" "postgres" {
  description = "Auditable PostgreSQL settings for ${local.name}"
  family      = "postgres17"
  name        = "${local.name}-postgres17"

  parameter {
    apply_method = "pending-reboot"
    name         = "rds.force_ssl"
    value        = "1"
  }
}

resource "aws_db_instance" "main" {
  allocated_storage               = var.database_storage_gb
  allow_major_version_upgrade     = false
  apply_immediately               = false
  auto_minor_version_upgrade      = true
  backup_retention_period         = 14
  backup_window                   = "09:00-10:00"
  copy_tags_to_snapshot           = true
  db_name                         = "gogymgo"
  db_subnet_group_name            = aws_db_subnet_group.main.name
  deletion_protection             = var.deletion_protection
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
  engine                          = "postgres"
  engine_version                  = "17"
  final_snapshot_identifier       = "${local.name}-final"
  identifier                      = "${local.name}-postgres"
  instance_class                  = var.database_instance_class
  kms_key_id                      = aws_kms_key.data.arn
  maintenance_window              = "sun:10:00-sun:11:00"
  manage_master_user_password     = true
  master_user_secret_kms_key_id   = aws_kms_key.data.arn
  max_allocated_storage           = 100
  monitoring_interval             = 0
  multi_az                        = var.database_multi_az
  parameter_group_name            = aws_db_parameter_group.postgres.name
  performance_insights_enabled    = false
  port                            = 5432
  publicly_accessible             = false
  skip_final_snapshot             = false
  storage_encrypted               = true
  storage_type                    = "gp3"
  username                        = "gogymgo_admin"
  vpc_security_group_ids          = [aws_security_group.database.id]

  lifecycle {
    prevent_destroy = true
    precondition {
      condition     = data.aws_caller_identity.current.account_id == var.account_id
      error_message = "Refusing to create the database outside the explicitly approved GoGymGo account."
    }
    precondition {
      condition     = var.environment != "production" || var.deletion_protection
      error_message = "Production requires deletion protection."
    }
  }
}
