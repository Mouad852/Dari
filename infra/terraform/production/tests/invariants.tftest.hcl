mock_provider "aws" {
  override_resource {
    target          = aws_security_group.alb
    override_during = plan
    values          = { id = "sg-alb" }
  }
  override_resource {
    target          = aws_security_group.api
    override_during = plan
    values          = { id = "sg-api" }
  }
  override_resource {
    target          = aws_security_group.web
    override_during = plan
    values          = { id = "sg-web" }
  }
  override_resource {
    target          = aws_security_group.rds
    override_during = plan
    values          = { id = "sg-rds" }
  }
  override_resource {
    target          = aws_security_group.db_bootstrap
    override_during = plan
    values          = { id = "sg-bootstrap" }
  }
}
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
    error_message = "RDS must use encrypted storage."
  }
  assert {
    condition     = aws_db_instance.dari.deletion_protection == true
    error_message = "RDS deletion protection is required."
  }
  assert {
    condition     = aws_db_instance.dari.backup_retention_period == 35
    error_message = "RDS must retain automated backups for 35 days."
  }
  assert {
    condition     = length(aws_security_group.rds.egress) == 0
    error_message = "RDS does not initiate connections and must have no egress rules."
  }
  assert {
    condition     = alltrue([for rule in aws_security_group.alb.ingress : length(rule.cidr_blocks) == 1 && rule.cidr_blocks[0] == "0.0.0.0/0" && contains([80, 443], rule.from_port) && rule.from_port == rule.to_port && rule.protocol == "tcp"])
    error_message = "Only the ALB may accept public traffic, and only on 80 and 443."
  }
  assert {
    condition     = alltrue([for group in [aws_security_group.api, aws_security_group.web, aws_security_group.rds] : alltrue([for rule in group.ingress : !contains(coalesce(rule.cidr_blocks, []), "0.0.0.0/0")])])
    error_message = "No security group other than the ALB may accept public ingress."
  }
  assert {
    condition     = length(aws_security_group.api.ingress) == 1 && alltrue([for rule in aws_security_group.api.ingress : rule.from_port == 8080 && rule.to_port == 8080 && rule.protocol == "tcp" && length(rule.security_groups) == 1 && contains(rule.security_groups, aws_security_group.alb.id)])
    error_message = "API ingress must be only port 8080 from the ALB security group."
  }
  assert {
    condition     = length(aws_security_group.web.ingress) == 1 && alltrue([for rule in aws_security_group.web.ingress : rule.from_port == 3000 && rule.to_port == 3000 && rule.protocol == "tcp" && length(rule.security_groups) == 1 && contains(rule.security_groups, aws_security_group.alb.id)])
    error_message = "Web ingress must be only port 3000 from the ALB security group."
  }
  assert {
    condition     = length(aws_security_group.rds.ingress) == 1 && alltrue([for rule in aws_security_group.rds.ingress : rule.from_port == 5432 && rule.to_port == 5432 && rule.protocol == "tcp" && length(rule.security_groups) == 1 && contains(rule.security_groups, aws_security_group.api.id)]) && aws_vpc_security_group_ingress_rule.rds_db_bootstrap.from_port == 5432 && aws_vpc_security_group_ingress_rule.rds_db_bootstrap.to_port == 5432 && aws_vpc_security_group_ingress_rule.rds_db_bootstrap.ip_protocol == "tcp" && aws_vpc_security_group_ingress_rule.rds_db_bootstrap.referenced_security_group_id == aws_security_group.db_bootstrap.id
    error_message = "RDS ingress must be only port 5432 from the API and bootstrap security groups."
  }
  assert {
    condition     = aws_s3_bucket_public_access_block.media.block_public_acls
    error_message = "Media storage must block public ACLs."
  }
  assert {
    condition     = aws_s3_bucket_public_access_block.media.block_public_policy
    error_message = "Media storage must block public bucket policies."
  }
  assert {
    condition     = aws_s3_bucket_public_access_block.media.ignore_public_acls
    error_message = "Media storage must ignore public ACLs."
  }
  assert {
    condition     = aws_s3_bucket_public_access_block.media.restrict_public_buckets
    error_message = "Media storage must restrict public buckets."
  }
  assert {
    condition     = aws_ecs_service.api.desired_count == 1
    error_message = "The default plan must run one API task."
  }
  assert {
    condition     = aws_ecs_service.web.desired_count == 1
    error_message = "The default plan must run one web task."
  }
  assert {
    condition     = local.db_bootstrap_image == "postgres:16.11"
    error_message = "The database bootstrap image must use an exact PostgreSQL version tag."
  }
  assert {
    condition     = strcontains(file("${path.module}/sql/bootstrap.sql"), "GRANT dari TO CURRENT_USER;") && !strcontains(file("${path.module}/sql/bootstrap.sql"), "\\set dari_password")
    error_message = "Bootstrap must grant its owner role to the master and avoid a psql password meta-command."
  }
  assert {
    condition     = jsondecode(aws_iam_role_policy.api_metrics.policy).Statement[0].Action == ["cloudwatch:PutMetricData"]
    error_message = "The API task policy must allow only PutMetricData."
  }
  assert {
    condition     = jsondecode(aws_iam_role_policy.api_metrics.policy).Statement[0].Condition.StringEquals["cloudwatch:namespace"] == "Dari/Api"
    error_message = "PutMetricData must be constrained to the Dari/Api namespace."
  }
  assert {
    condition     = alltrue([for parameter in values(aws_ssm_parameter.secret) : parameter.value == "SET_OUT_OF_BAND_BY_OWNER"])
    error_message = "Every SSM secret must contain the out-of-band placeholder in Terraform."
  }
  assert {
    condition     = alltrue([for repository in [aws_ecr_repository.api, aws_ecr_repository.web] : repository.image_tag_mutability == "IMMUTABLE"])
    error_message = "ECR tags must be immutable."
  }
  assert {
    condition     = alltrue([for repository in [aws_ecr_repository.api, aws_ecr_repository.web] : repository.image_scanning_configuration[0].scan_on_push])
    error_message = "ECR must scan every image on push."
  }
  assert {
    condition     = contains(["redirect-to-https", "https-only"], aws_cloudfront_distribution.media.default_cache_behavior[0].viewer_protocol_policy)
    error_message = "CloudFront viewers must use HTTPS."
  }
  assert {
    condition     = aws_lb.main.drop_invalid_header_fields
    error_message = "The ALB must drop invalid header fields."
  }
  assert {
    condition     = aws_lb_listener.http.default_action[0].type == "redirect" && aws_lb_listener.http.default_action[0].redirect[0].protocol == "HTTPS" && aws_lb_listener.http.default_action[0].redirect[0].port == "443"
    error_message = "The HTTP listener must redirect every request to HTTPS on 443."
  }
  assert {
    condition     = anytrue([for rule in aws_backup_plan.production.rule : anytrue([for lifecycle in rule.lifecycle : lifecycle.delete_after == 7])])
    error_message = "The daily backup rule must retain seven days."
  }
}

run "zero_desired_count_plans_no_service_tasks" {
  command = plan

  variables {
    service_desired_count = 0
  }

  assert {
    condition     = aws_ecs_service.api.desired_count == 0
    error_message = "A dependency-only plan must start zero API tasks."
  }
  assert {
    condition     = aws_ecs_service.web.desired_count == 0
    error_message = "A dependency-only plan must start zero web tasks."
  }
}
