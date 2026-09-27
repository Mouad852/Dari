#checkov:skip=CKV_AWS_144:Bootstrap state bucket is single-region by design; cross-region replication is a manual recovery decision.
#checkov:skip=CKV_AWS_145:Bootstrap uses provider-managed AES256 encryption before production KMS exists.
#checkov:skip=CKV_AWS_18:Bootstrap has no separate log bucket; access is audited through AWS account logs.
#checkov:skip=CKV2_AWS_61:State history is retained by versioning; a lifecycle expiry would undermine recovery.
#checkov:skip=CKV2_AWS_62:Terraform state has no event-processing requirement.
resource "aws_s3_bucket" "terraform_state" {
  #checkov:skip=CKV_AWS_144:Bootstrap state bucket is single-region by design; cross-region replication is a manual recovery decision.
  #checkov:skip=CKV_AWS_145:Bootstrap uses provider-managed AES256 encryption before production KMS exists.
  #checkov:skip=CKV_AWS_18:Bootstrap has no separate log bucket; access is audited through AWS account logs.
  #checkov:skip=CKV2_AWS_61:State history is retained by versioning; a lifecycle expiry would undermine recovery.
  #checkov:skip=CKV2_AWS_62:Terraform state has no event-processing requirement.
  bucket = var.state_bucket_name
}

resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "terraform_state" {
  bucket                  = aws_s3_bucket.terraform_state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_policy" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "DenyInsecureTransport"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource  = [aws_s3_bucket.terraform_state.arn, "${aws_s3_bucket.terraform_state.arn}/*"]
      Condition = { Bool = { "aws:SecureTransport" = "false" } }
    }]
  })
}

