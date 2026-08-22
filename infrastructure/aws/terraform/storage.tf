resource "aws_s3_bucket" "user_content" {
  bucket        = "${var.account_id}-${var.environment}-gogymgo-content"
  force_destroy = false

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket" "privacy_exports" {
  bucket        = "${var.account_id}-${var.environment}-gogymgo-privacy"
  force_destroy = false

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_public_access_block" "content" {
  block_public_acls       = true
  block_public_policy     = true
  bucket                  = aws_s3_bucket.user_content.id
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "privacy" {
  block_public_acls       = true
  block_public_policy     = true
  bucket                  = aws_s3_bucket.privacy_exports.id
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "content" {
  bucket = aws_s3_bucket.user_content.id
  rule { object_ownership = "BucketOwnerEnforced" }
}

resource "aws_s3_bucket_ownership_controls" "privacy" {
  bucket = aws_s3_bucket.privacy_exports.id
  rule { object_ownership = "BucketOwnerEnforced" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "content" {
  bucket = aws_s3_bucket.user_content.id
  rule {
    bucket_key_enabled = true
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.data.arn
      sse_algorithm     = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "privacy" {
  bucket = aws_s3_bucket.privacy_exports.id
  rule {
    bucket_key_enabled = true
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.data.arn
      sse_algorithm     = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_versioning" "content" {
  bucket = aws_s3_bucket.user_content.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_versioning" "privacy" {
  bucket = aws_s3_bucket.privacy_exports.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_lifecycle_configuration" "content" {
  bucket = aws_s3_bucket.user_content.id

  rule {
    id     = "abort-incomplete-uploads"
    status = "Enabled"
    filter {}
    abort_incomplete_multipart_upload { days_after_initiation = 1 }
    noncurrent_version_expiration { noncurrent_days = 30 }
  }

  depends_on = [aws_s3_bucket_versioning.content]
}

resource "aws_s3_bucket_lifecycle_configuration" "privacy" {
  bucket = aws_s3_bucket.privacy_exports.id

  rule {
    id     = "delete-expired-privacy-exports"
    status = "Enabled"
    filter {}
    expiration { days = 7 }
    abort_incomplete_multipart_upload { days_after_initiation = 1 }
    noncurrent_version_expiration { noncurrent_days = 7 }
  }

  depends_on = [aws_s3_bucket_versioning.privacy]
}

resource "aws_s3_bucket_cors_configuration" "content" {
  bucket = aws_s3_bucket.user_content.id

  cors_rule {
    allowed_headers = ["cache-control", "content-type", "if-none-match", "x-amz-meta-media-id"]
    allowed_methods = ["GET", "HEAD", "PUT"]
    allowed_origins = var.cors_origins
    expose_headers  = ["ETag"]
    max_age_seconds = 300
  }
}

data "aws_iam_policy_document" "bucket_tls" {
  for_each = {
    content = aws_s3_bucket.user_content.arn
    privacy = aws_s3_bucket.privacy_exports.arn
  }

  statement {
    actions = ["s3:*"]
    effect  = "Deny"
    resources = [
      each.value,
      "${each.value}/*",
    ]
    principals {
      identifiers = ["*"]
      type        = "*"
    }
    condition {
      test     = "Bool"
      values   = ["false"]
      variable = "aws:SecureTransport"
    }
  }
}

resource "aws_s3_bucket_policy" "content" {
  bucket = aws_s3_bucket.user_content.id
  policy = data.aws_iam_policy_document.bucket_tls["content"].json

  depends_on = [aws_s3_bucket_public_access_block.content]
}

resource "aws_s3_bucket_policy" "privacy" {
  bucket = aws_s3_bucket.privacy_exports.id
  policy = data.aws_iam_policy_document.bucket_tls["privacy"].json

  depends_on = [aws_s3_bucket_public_access_block.privacy]
}

resource "aws_ecr_repository" "backend" {
  encryption_configuration { encryption_type = "AES256" }
  image_scanning_configuration { scan_on_push = true }
  image_tag_mutability = "IMMUTABLE"
  name                 = "${local.name}-backend"
}

resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name
  policy = jsonencode({
    rules = [{
      action       = { type = "expire" }
      description  = "Remove untagged images after seven days"
      rulePriority = 1
      selection = {
        countNumber = 7
        countType   = "sinceImagePushed"
        countUnit   = "days"
        tagStatus   = "untagged"
      }
    }]
  })
}
