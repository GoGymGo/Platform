mock_provider "aws" {
  mock_data "aws_caller_identity" {
    defaults = { account_id = "111122223333" }
  }

  mock_data "aws_availability_zones" {
    defaults = { names = ["ca-central-1a", "ca-central-1b"] }
  }

  mock_data "aws_iam_policy_document" {
    defaults = {
      json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}"
    }
  }
}

variables {
  account_id          = "111122223333"
  environment         = "staging"
  container_image     = "111122223333.dkr.ecr.ca-central-1.amazonaws.com/gogymgo-staging-backend/api@sha256:0000000000000000000000000000000000000000000000000000000000000000"
  firebase_project_id = "gogymgo-staging"
  cors_origins        = ["https://staging.gogymgo.com"]
  deletion_protection = false
}

run "safe_isolated_foundation" {
  command = plan

  assert {
    condition     = aws_db_instance.main.publicly_accessible == false
    error_message = "RDS must not have a public endpoint."
  }

  assert {
    condition     = aws_db_instance.main.storage_encrypted && aws_db_instance.main.manage_master_user_password
    error_message = "RDS storage and its AWS-managed master credential must remain encrypted."
  }

  assert {
    condition     = aws_s3_bucket_public_access_block.content.restrict_public_buckets && aws_s3_bucket_public_access_block.privacy.restrict_public_buckets
    error_message = "Both private buckets must block all public access paths."
  }

  assert {
    condition     = aws_s3_bucket_versioning.content.versioning_configuration[0].status == "Enabled" && aws_s3_bucket_versioning.privacy.versioning_configuration[0].status == "Enabled"
    error_message = "Private content must preserve exact S3 versions for fenced cleanup and recovery."
  }

  assert {
    condition     = aws_s3_bucket_public_access_block.member_web.restrict_public_buckets && aws_s3_bucket_public_access_block.member_web.block_public_policy && aws_s3_bucket_ownership_controls.member_web.rule[0].object_ownership == "BucketOwnerEnforced"
    error_message = "The member-app origin must remain private and ACL-free."
  }

  assert {
    condition     = aws_cloudfront_origin_access_control.member_web.signing_behavior == "always" && aws_cloudfront_distribution.member_web.default_cache_behavior[0].viewer_protocol_policy == "redirect-to-https"
    error_message = "CloudFront must sign private origin requests and force browser HTTPS."
  }

  assert {
    condition     = strcontains(aws_cloudfront_function.member_web_spa.code, "request.uri = '/index.html'")
    error_message = "CloudFront must route extensionless Expo Router paths through the SPA entrypoint."
  }

  assert {
    condition     = strcontains(aws_cloudfront_function.member_web_spa.code, "request.uri.startsWith('/.well-known/')") && strcontains(aws_cloudfront_function.member_web_spa.code, "!associationFile")
    error_message = "CloudFront must serve native association files directly instead of rewriting them to the SPA entrypoint."
  }

  assert {
    condition     = aws_iam_role.github_member_web_deploy.name == "gogymgo-staging-github-member-web"
    error_message = "Member-app publishing must use a separate environment-scoped GitHub role."
  }

  assert {
    condition     = aws_ecs_service.api.network_configuration[0].assign_public_ip && aws_vpc_security_group_ingress_rule.api_load_balancer.from_port == 3000 && aws_vpc_security_group_ingress_rule.api_load_balancer.cidr_ipv4 == null
    error_message = "The NAT-free pilot requires public task egress while security-group rules keep API ingress load-balancer-only."
  }

  assert {
    condition     = aws_ecs_service.api.deployment_minimum_healthy_percent == 100 && aws_ecs_service.worker.deployment_minimum_healthy_percent == 100
    error_message = "API and worker rollouts must preserve their healthy task while a replacement starts."
  }

  assert {
    condition     = aws_ecs_task_definition.api.cpu == "512" && aws_ecs_task_definition.api.memory == "1024" && aws_ecs_task_definition.worker.cpu == "256" && aws_ecs_task_definition.worker.memory == "512"
    error_message = "Pilot runtime sizes must remain explicit supported Fargate pairs."
  }

  assert {
    condition     = aws_ecs_task_definition.api.skip_destroy && aws_ecs_task_definition.worker.skip_destroy && aws_ecs_task_definition.migration.skip_destroy
    error_message = "API, worker, and migration rollback revisions must remain active after task-definition replacement."
  }

  assert {
    condition     = length(aws_ecs_service.api.load_balancer) == 0
    error_message = "The bootstrap API service must not attach an unassociated target group before an HTTPS certificate and listener exist."
  }

  assert {
    condition     = local.api_environment.PRIVATE_OBJECT_STORAGE_PROVIDER == "aws-s3" && local.api_environment.AWS_REGION == "ca-central-1"
    error_message = "AWS tasks must select the S3 adapter explicitly."
  }

  assert {
    condition     = contains(keys(local.api_secret_environment), "GOGYMGO_OWNER_EMAIL") && !contains(keys(local.worker_secret_environment), "GOGYMGO_OWNER_EMAIL")
    error_message = "Only the API task may receive the protected owner identity."
  }

  assert {
    condition     = aws_iam_role.ecs_execution_scoped["api"].name == "gogymgo-staging-ecs-execution-api" && aws_iam_role.ecs_execution_scoped["worker"].name == "gogymgo-staging-ecs-execution-worker" && aws_iam_role.ecs_execution_scoped["migration"].name == "gogymgo-staging-ecs-execution-migration"
    error_message = "API, worker, and migration tasks must use separate execution roles."
  }

  assert {
    condition     = aws_iam_role.ecs_execution_legacy.name == "gogymgo-staging-ecs-execution" && aws_iam_role_policy.ecs_execution_legacy.name == "gogymgo-staging-ecs-execution"
    error_message = "The shared execution role must remain managed until the protected workload cutover is complete."
  }

  assert {
    condition     = aws_budgets_budget.monthly.cost_types[0].include_credit == false && aws_budgets_budget.monthly.cost_types[0].include_refund == false
    error_message = "The staging budget must measure gross usage before credits and refunds obscure the underlying run rate."
  }

  assert {
    condition     = aws_kms_key.data.policy != null
    error_message = "The application KMS key must have an explicit service-aware key policy."
  }

  assert {
    condition     = local.github_oidc_subject == "repo:GoGymGo@275516911/Platform@1294409363:environment:staging"
    error_message = "The GitHub deployment role must trust the immutable repository identity for the selected environment."
  }

}

run "feature_secrets_remain_role_scoped" {
  command = plan

  variables {
    privacy_operations_enabled = true
    profile_media_enabled      = true
    push_notifications_enabled = true
  }

  assert {
    condition     = length(local.api_secret_environment) == 4 && length(local.worker_secret_environment) == 4
    error_message = "API-only and worker-only secret injection must remain isolated."
  }

  assert {
    condition     = !contains(keys(local.api_secret_environment), "PRIVACY_PSEUDONYMIZATION_KEY") && !contains(keys(local.api_secret_environment), "EXPO_PUSH_ACCESS_TOKEN") && !contains(keys(local.worker_secret_environment), "REWARD_CODE_ENCRYPTION_KEY")
    error_message = "Runtime tasks must not receive secrets they do not consume."
  }

  assert {
    condition     = length(local.execution_secret_arns.api) == 4 && length(local.execution_secret_arns.worker) == 4 && length(local.execution_secret_arns.migration) == 1
    error_message = "Execution-role secret reads must match the exact runtime mappings."
  }
}

run "landing_cutover_configuration_is_api_scoped" {
  command = plan

  variables {
    landing_intake_enabled        = true
    landing_intake_retention_days = 90
  }

  assert {
    condition     = local.api_environment.LANDING_INTAKE_ENABLED == "true" && local.api_environment.LANDING_INTAKE_RETENTION_DAYS == "90"
    error_message = "Landing cutover must carry the reviewed API enablement and retention configuration."
  }

  assert {
    condition     = contains(keys(local.api_secret_environment), "LANDING_INTAKE_FORWARDING_SECRET") && !contains(keys(local.worker_secret_environment), "LANDING_INTAKE_FORWARDING_SECRET")
    error_message = "Only the API may receive the landing forwarding secret."
  }
}

run "production_requires_alert_destinations" {
  command = plan

  variables {
    budget_notification_email = null
    deletion_protection       = true
    environment               = "production"
  }

  expect_failures = [aws_budgets_budget.monthly]
}
