output "alb_dns_name" { value = aws_lb.main.dns_name }
output "api_ecr_repository_url" { value = aws_ecr_repository.api.repository_url }
output "web_ecr_repository_url" { value = aws_ecr_repository.web.repository_url }
output "rds_endpoint" { value = aws_db_instance.dari.address }
output "ecs_cluster_arn" { value = aws_ecs_cluster.main.arn }
output "db_bootstrap_task_definition_arn" { value = aws_ecs_task_definition.db_bootstrap.arn }
output "db_bootstrap_public_subnet_ids" { value = aws_subnet.public[*].id }
output "db_bootstrap_security_group_id" { value = aws_security_group.db_bootstrap.id }
output "db_bootstrap_log_group_name" { value = aws_cloudwatch_log_group.db_bootstrap.name }
output "cloudfront_domain_name" { value = aws_cloudfront_distribution.media.domain_name }
output "ssm_parameter_names" { value = { for k, p in aws_ssm_parameter.secret : k => p.name } }
output "sns_topic_arns" { value = { region = aws_sns_topic.alerts.arn, us_east_1 = aws_sns_topic.alerts_us_east_1.arn } }
output "acm_dns_validation_records" { value = [for d in aws_acm_certificate.main.domain_validation_options : { name = d.resource_record_name, type = d.resource_record_type, value = d.resource_record_value }] }
output "ses_dkim_records" { value = [for token in aws_ses_domain_dkim.main.dkim_tokens : { name = "${token}._domainkey.${var.web_domain}", type = "CNAME", value = "${token}.dkim.amazonses.com" }] }
output "route53_records" { value = { web = var.web_domain, api = var.api_domain } }
output "manual_cross_account_backup_prerequisites" { value = "Backup account ${var.backup_account_id} must enable Organizations cross-account backup, create a non-default CMK-encrypted vault, and allow CopyIntoBackupVault before enable_cross_account_backup_copy=true." }
