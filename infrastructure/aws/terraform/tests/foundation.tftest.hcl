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
    condition     = aws_ecs_service.api.network_configuration[0].assign_public_ip && aws_vpc_security_group_ingress_rule.api_load_balancer.from_port == 3000 && aws_vpc_security_group_ingress_rule.api_load_balancer.cidr_ipv4 == null
    error_message = "The NAT-free pilot requires public task egress while security-group rules keep API ingress load-balancer-only."
  }

  assert {
    condition     = local.api_environment.PRIVATE_OBJECT_STORAGE_PROVIDER == "aws-s3" && local.api_environment.AWS_REGION == "ca-central-1"
    error_message = "AWS tasks must select the S3 adapter explicitly."
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
    condition     = length(local.api_secret_environment) == 3 && length(local.worker_secret_environment) == 4
    error_message = "API-only and worker-only secret injection must remain isolated."
  }

  assert {
    condition     = !contains(keys(local.api_secret_environment), "PRIVACY_PSEUDONYMIZATION_KEY") && !contains(keys(local.api_secret_environment), "EXPO_PUSH_ACCESS_TOKEN") && !contains(keys(local.worker_secret_environment), "REWARD_CODE_ENCRYPTION_KEY")
    error_message = "Runtime tasks must not receive secrets they do not consume."
  }
}
