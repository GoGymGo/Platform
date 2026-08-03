data "aws_iam_policy_document" "data_kms" {
  statement {
    sid    = "EnableIAMPolicies"
    effect = "Allow"

    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${var.account_id}:root"]
    }

    actions   = ["kms:*"]
    resources = ["*"]
  }

  statement {
    sid    = "AllowCloudWatchLogsEncryption"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["logs.${var.region}.amazonaws.com"]
    }

    actions = [
      "kms:Decrypt*",
      "kms:Describe*",
      "kms:Encrypt*",
      "kms:GenerateDataKey*",
      "kms:ReEncrypt*",
    ]
    resources = ["*"]

    condition {
      test     = "ArnEquals"
      variable = "kms:EncryptionContext:aws:logs:arn"
      values = [
        "arn:aws:logs:${var.region}:${var.account_id}:log-group:/gogymgo/${var.environment}/application",
      ]
    }
  }
}

resource "aws_kms_key" "data" {
  description             = "GoGymGo ${var.environment} application data"
  deletion_window_in_days = var.environment == "production" ? 30 : 7
  enable_key_rotation     = true
  policy                  = data.aws_iam_policy_document.data_kms.json
}

resource "aws_kms_alias" "data" {
  name          = "alias/${local.name}-data"
  target_key_id = aws_kms_key.data.key_id
}
