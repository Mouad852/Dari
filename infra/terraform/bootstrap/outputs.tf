output "state_bucket_name" {
  value       = aws_s3_bucket.terraform_state.bucket
  description = "Use as the production S3 backend bucket."
}

output "state_bucket_arn" {
  value = aws_s3_bucket.terraform_state.arn
}

