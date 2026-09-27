mock_provider "aws" {}
mock_provider "aws" { alias = "us_east_1" }

variables {
  region                = "eu-west-3"
  web_domain            = "www.example.invalid"
  api_domain            = "api.example.invalid"
  alert_email           = "alerts@example.invalid"
  monthly_budget_amount = 60
  api_image_tag         = "test-api"
  web_image_tag         = "test-web"
  backup_account_id     = "000000000000"
  log_retention_days    = 30
}

run "production_invariants" {
  command = plan

  assert {
    condition     = aws_db_instance.dari.publicly_accessible == false
    error_message = "RDS must remain private."
  }
  assert {
    condition     = aws_db_instance.dari.storage_encrypted == true
    error_message = "RDS must use encrypted storage; the production configuration binds the customer-managed key."
  }
  assert {
    condition     = aws_db_instance.dari.deletion_protection == true && aws_db_instance.dari.backup_retention_period == 35
    error_message = "RDS deletion protection and 35-day retention are required."
  }
  assert {
    condition     = aws_s3_bucket_public_access_block.media.block_public_acls && aws_s3_bucket_public_access_block.media.block_public_policy && aws_s3_bucket_public_access_block.media.ignore_public_acls && aws_s3_bucket_public_access_block.media.restrict_public_buckets
    error_message = "Media storage must block all public access controls."
  }
  assert {
    condition     = aws_ecs_service.api.desired_count == 1 && aws_ecs_service.web.desired_count == 1
    error_message = "Option A runs exactly one API task and one web task."
  }
  assert {
    condition     = aws_iam_role_policy.api_metrics.policy != null
    error_message = "The API task role must have the namespace-scoped metric policy."
  }
  assert {
    condition     = anytrue([for r in aws_backup_plan.production.rule : anytrue([for l in r.lifecycle : l.delete_after == 7])])
    error_message = "The daily backup rule must retain seven days."
  }
  assert {
    condition     = aws_ssm_parameter.secret["DARI_SSR_SHARED_SECRET"].value == "SET_OUT_OF_BAND_BY_OWNER"
    error_message = "SSM secrets must contain placeholders in Terraform, never real values."
  }
}
