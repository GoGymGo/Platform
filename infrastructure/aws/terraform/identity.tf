data "aws_iam_policy_document" "ecs_tasks_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      identifiers = ["ecs-tasks.amazonaws.com"]
      type        = "Service"
    }
  }
}

resource "aws_iam_role" "ecs_execution" {
  for_each = local.execution_secret_arns

  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
  name               = "${local.name}-ecs-execution-${each.key}"
}

data "aws_iam_policy_document" "ecs_execution" {
  for_each = local.execution_secret_arns

  statement {
    actions = [
      "ecr:GetAuthorizationToken",
    ]
    resources = ["*"]
  }

  statement {
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer",
    ]
    resources = [aws_ecr_repository.backend.arn]
  }

  statement {
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["${aws_cloudwatch_log_group.application.arn}:*"]
  }

  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = each.value
  }

  statement {
    actions   = ["kms:Decrypt"]
    resources = [aws_kms_key.data.arn]
  }
}

resource "aws_iam_role_policy" "ecs_execution" {
  for_each = local.execution_secret_arns

  name   = "${local.name}-ecs-execution-${each.key}"
  policy = data.aws_iam_policy_document.ecs_execution[each.key].json
  role   = aws_iam_role.ecs_execution[each.key].id
}

resource "aws_iam_role" "api" {
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
  name               = "${local.name}-api"
}

resource "aws_iam_role" "worker" {
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
  name               = "${local.name}-worker"
}

resource "aws_iam_role" "migration" {
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
  name               = "${local.name}-migration"
}

data "aws_iam_policy_document" "api" {
  statement {
    actions   = ["s3:GetObject", "s3:PutObject"]
    resources = ["${aws_s3_bucket.user_content.arn}/avatars/*"]
  }

  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.privacy_exports.arn}/privacy-exports/*"]
  }

  statement {
    actions   = ["kms:Decrypt", "kms:GenerateDataKey"]
    resources = [aws_kms_key.data.arn]
  }
}

resource "aws_iam_role_policy" "api" {
  name   = "${local.name}-api-storage"
  policy = data.aws_iam_policy_document.api.json
  role   = aws_iam_role.api.id
}

data "aws_iam_policy_document" "worker" {
  statement {
    actions   = ["s3:DeleteObject", "s3:DeleteObjectVersion", "s3:GetObject"]
    resources = ["${aws_s3_bucket.user_content.arn}/avatars/*"]
  }

  statement {
    actions = [
      "s3:DeleteObject",
      "s3:DeleteObjectVersion",
      "s3:GetObject",
      "s3:PutObject",
    ]
    resources = ["${aws_s3_bucket.privacy_exports.arn}/privacy-exports/*"]
  }

  statement {
    actions   = ["kms:Decrypt", "kms:GenerateDataKey"]
    resources = [aws_kms_key.data.arn]
  }
}

resource "aws_iam_role_policy" "worker" {
  name   = "${local.name}-worker-storage"
  policy = data.aws_iam_policy_document.worker.json
  role   = aws_iam_role.worker.id
}

resource "aws_iam_openid_connect_provider" "github" {
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
  url             = "https://token.actions.githubusercontent.com"
}

data "aws_iam_policy_document" "github_deploy_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      identifiers = [aws_iam_openid_connect_provider.github.arn]
      type        = "Federated"
    }
    condition {
      test     = "StringEquals"
      values   = ["sts.amazonaws.com"]
      variable = "token.actions.githubusercontent.com:aud"
    }
    condition {
      test     = "StringEquals"
      values   = [local.github_oidc_subject]
      variable = "token.actions.githubusercontent.com:sub"
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  assume_role_policy   = data.aws_iam_policy_document.github_deploy_assume.json
  max_session_duration = 3600
  name                 = "${local.name}-github-deploy"
}

data "aws_iam_policy_document" "github_deploy" {
  statement {
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:CompleteLayerUpload",
      "ecr:DescribeImages",
      "ecr:DescribeRepositories",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
    ]
    resources = [aws_ecr_repository.backend.arn]
  }

  statement {
    actions = [
      "ecs:DescribeServices",
      "ecs:DescribeTaskDefinition",
      "ecs:DescribeTasks",
      "ecs:RegisterTaskDefinition",
      "ecs:RunTask",
      "ecs:UpdateService",
    ]
    resources = ["*"]
  }

  statement {
    actions = ["iam:PassRole"]
    resources = concat(
      [
        aws_iam_role.api.arn,
        aws_iam_role.migration.arn,
        aws_iam_role.worker.arn,
      ],
      values(aws_iam_role.ecs_execution)[*].arn,
    )
    condition {
      test     = "StringEquals"
      values   = ["ecs-tasks.amazonaws.com"]
      variable = "iam:PassedToService"
    }
  }
}

resource "aws_iam_role_policy" "github_deploy" {
  name   = "${local.name}-release"
  policy = data.aws_iam_policy_document.github_deploy.json
  role   = aws_iam_role.github_deploy.id
}

resource "aws_iam_role" "github_member_web_deploy" {
  assume_role_policy   = data.aws_iam_policy_document.github_deploy_assume.json
  max_session_duration = 3600
  name                 = "${local.name}-github-member-web"
}

data "aws_iam_policy_document" "github_member_web_deploy" {
  statement {
    actions = [
      "s3:GetBucketLocation",
      "s3:ListBucket",
    ]
    resources = [aws_s3_bucket.member_web.arn]
  }

  statement {
    actions = [
      "s3:DeleteObject",
      "s3:GetObject",
      "s3:PutObject",
    ]
    resources = ["${aws_s3_bucket.member_web.arn}/*"]
  }

  statement {
    actions = [
      "cloudfront:CreateInvalidation",
      "cloudfront:GetInvalidation",
    ]
    resources = [aws_cloudfront_distribution.member_web.arn]
  }
}

resource "aws_iam_role_policy" "github_member_web_deploy" {
  name   = "${local.name}-member-web-release"
  policy = data.aws_iam_policy_document.github_member_web_deploy.json
  role   = aws_iam_role.github_member_web_deploy.id
}
