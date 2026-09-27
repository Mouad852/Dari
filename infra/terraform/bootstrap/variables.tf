variable "region" {
  type        = string
  description = "AWS region selected after the counsel data-residency decision."
}

variable "state_bucket_name" {
  type        = string
  description = "Globally unique bucket name for Terraform state."
}

