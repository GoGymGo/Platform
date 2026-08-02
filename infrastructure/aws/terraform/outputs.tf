output "account_id" {
  description = "AWS account guard used by this isolated environment."
  value       = data.aws_caller_identity.current.account_id
}

output "api_load_balancer_dns_name" {
  description = "Cloudflare DNS target; changing DNS remains a separate approval gate."
  value       = aws_lb.api.dns_name
}

output "api_url" {
  description = "Public API URL after ACM and Cloudflare DNS are configured."
  value       = var.api_domain == null || var.api_certificate_arn == null ? null : "https://${var.api_domain}"
}

output "database_endpoint" {
  description = "Private PostgreSQL endpoint used to assemble DATABASE_URL outside Terraform state."
  value       = aws_db_instance.main.endpoint
}

output "database_master_secret_arn" {
  description = "AWS-managed master credential used only to bootstrap the least-privilege application login."
  value       = one(aws_db_instance.main.master_user_secret).secret_arn
}

output "deployment_role_arn" {
  description = "GitHub environment OIDC role for ordered image-only releases."
  value       = aws_iam_role.github_deploy.arn
}

output "ecr_repository_url" {
  description = "Environment-specific immutable image repository."
  value       = aws_ecr_repository.backend.repository_url
}

output "ecs" {
  description = "GitHub environment values for the ordered release workflow."
  value = {
    api_service               = aws_ecs_service.api.name
    api_task_definition       = aws_ecs_task_definition.api.family
    cluster                   = aws_ecs_cluster.main.name
    migration_security_groups = [aws_security_group.migration.id]
    migration_subnets         = aws_subnet.public[*].id
    migration_task_definition = aws_ecs_task_definition.migration.family
    worker_service            = aws_ecs_service.worker.name
    worker_task_definition    = aws_ecs_task_definition.worker.family
  }
}

output "runtime_secret_arns" {
  description = "Empty secret containers that must be populated outside Terraform state before task startup."
  value       = { for name, secret in aws_secretsmanager_secret.runtime : name => secret.arn }
}
