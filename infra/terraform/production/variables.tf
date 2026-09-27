variable "region" {
  type        = string
  description = "AWS region chosen after counsel's data-residency decision."
}
variable "web_domain" { type = string }
variable "api_domain" { type = string }
variable "route53_zone_id" {
  type     = string
  default  = null
  nullable = true
}
variable "alert_email" { type = string }
variable "monthly_budget_amount" { type = number }
variable "api_image_tag" { type = string }
variable "web_image_tag" { type = string }
variable "backup_account_id" { type = string }
variable "log_retention_days" {
  type = number
  validation {
    condition     = var.log_retention_days > 0 && var.log_retention_days <= 3653
    error_message = "Use a positive CloudWatch retention period no longer than 10 years."
  }
}
variable "enable_cross_account_backup_copy" {
  type    = bool
  default = false
}
variable "backup_destination_vault_arn" {
  type     = string
  default  = null
  nullable = true
}
variable "enable_media_replication" {
  type    = bool
  default = false
}
variable "replication_destination_bucket_arn" {
  type     = string
  default  = null
  nullable = true
}

variable "vpc_cidr" {
  type    = string
  default = "10.42.0.0/16"
}
variable "public_subnet_cidrs" {
  type    = list(string)
  default = ["10.42.1.0/24", "10.42.2.0/24"]
}
variable "private_subnet_cidrs" {
  type    = list(string)
  default = ["10.42.11.0/24", "10.42.12.0/24"]
}

variable "api_trusted_proxy_ips" {
  type        = string
  description = "Java regex matching only ALB target-facing private subnet ranges; owner must replace the example before apply."
  default     = "^10\\.42\\.(1|2)\\."
}

variable "web_task_memory" {
  type        = number
  description = "MiB for one web task, measured from the standalone image; 1024 is the Phase 8 baseline."
  default     = 1024
}

