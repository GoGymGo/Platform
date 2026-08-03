resource "aws_s3_bucket" "member_web" {
  bucket = "${local.name}-member-web-${var.account_id}"
}

resource "aws_s3_bucket_ownership_controls" "member_web" {
  bucket = aws_s3_bucket.member_web.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "member_web" {
  bucket = aws_s3_bucket.member_web.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# The bucket contains only compiled public browser assets. SSE-S3 provides
# encryption at rest without a customer-managed key's fixed and per-request
# cost; authenticated user data remains in the separate KMS-encrypted buckets.
#trivy:ignore:AVD-AWS-0132
resource "aws_s3_bucket_server_side_encryption_configuration" "member_web" {
  bucket = aws_s3_bucket.member_web.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "member_web" {
  bucket = aws_s3_bucket.member_web.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "member_web" {
  bucket = aws_s3_bucket.member_web.id

  rule {
    id     = "discard-stale-deployment-versions"
    status = "Enabled"

    filter {}

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }

  depends_on = [aws_s3_bucket_versioning.member_web]
}

resource "aws_cloudfront_origin_access_control" "member_web" {
  name                              = "${local.name}-member-web"
  description                       = "Private S3 access for the GoGymGo member app"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_function" "member_web_spa" {
  name    = "${local.name}-member-web-spa"
  runtime = "cloudfront-js-2.0"
  comment = "Serve Expo Router browser routes through the SPA entrypoint"
  publish = true
  code    = <<-JAVASCRIPT
    function handler(event) {
      var request = event.request;
      var lastSegment = request.uri.split('/').pop();

      if (request.uri.endsWith('/') || !lastSegment.includes('.')) {
        request.uri = '/index.html';
      }

      return request;
    }
  JAVASCRIPT
}

resource "aws_cloudfront_response_headers_policy" "member_web" {
  name    = "${local.name}-member-web-security"
  comment = "Browser security headers for the GoGymGo member app"

  security_headers_config {
    content_type_options {
      override = true
    }

    frame_options {
      frame_option = "DENY"
      override     = true
    }

    referrer_policy {
      override        = true
      referrer_policy = "strict-origin-when-cross-origin"
    }

    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = true
      override                   = true
      preload                    = false
    }

    xss_protection {
      mode_block = true
      override   = true
      protection = true
    }
  }
}

# This distribution serves immutable static assets from a private origin and
# accepts only read methods. AWS Shield Standard remains automatic; a paid WAF
# is a separate traffic/risk gate rather than a staging fixed-cost dependency.
#trivy:ignore:AVD-AWS-0011
resource "aws_cloudfront_distribution" "member_web" {
  aliases             = var.member_web_certificate_arn == null ? [] : [var.member_web_domain]
  comment             = "GoGymGo ${var.environment} browser member app"
  default_root_object = "index.html"
  enabled             = true
  http_version        = "http2and3"
  is_ipv6_enabled     = true
  price_class         = "PriceClass_100"

  origin {
    domain_name              = aws_s3_bucket.member_web.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.member_web.id
    origin_id                = "member-web-s3"
  }

  default_cache_behavior {
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD", "OPTIONS"]
    cache_policy_id            = "658327ea-f89d-4fab-a63d-7e88639e58f6"
    compress                   = true
    response_headers_policy_id = aws_cloudfront_response_headers_policy.member_web.id
    target_origin_id           = "member-web-s3"
    viewer_protocol_policy     = "redirect-to-https"

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.member_web_spa.arn
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn            = var.member_web_certificate_arn
    cloudfront_default_certificate = var.member_web_certificate_arn == null
    minimum_protocol_version       = var.member_web_certificate_arn == null ? "TLSv1" : "TLSv1.2_2021"
    ssl_support_method             = var.member_web_certificate_arn == null ? null : "sni-only"
  }
}

data "aws_iam_policy_document" "member_web_bucket" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.member_web.arn}/*"]

    principals {
      identifiers = ["cloudfront.amazonaws.com"]
      type        = "Service"
    }

    condition {
      test     = "StringEquals"
      values   = [aws_cloudfront_distribution.member_web.arn]
      variable = "AWS:SourceArn"
    }
  }
}

resource "aws_s3_bucket_policy" "member_web" {
  bucket = aws_s3_bucket.member_web.id
  policy = data.aws_iam_policy_document.member_web_bucket.json
}
