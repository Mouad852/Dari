data "aws_availability_zones" "available" {
  state = "available"
}
data "aws_caller_identity" "current" {}

locals {
  azs  = slice(concat(data.aws_availability_zones.available.names, ["us-east-1", "us-east-2"]), 0, 2)
  name = "dari"
  secret_names = toset([
    "POSTGRES_USER", "POSTGRES_PASSWORD", "DARI_LOCATION_FUZZ_SECRET",
    "DARI_SSR_SHARED_SECRET", "DARI_MEDIA_S3_ACCESS_KEY",
    "DARI_MEDIA_S3_SECRET_KEY", "SMTP_USERNAME", "SMTP_PASSWORD",
    "DARI_NOTIFICATIONS_FROM", "FIREBASE_SERVICE_ACCOUNT_JSON", "SENTRY_DSN"
  ])
  placeholder = "SET_OUT_OF_BAND_BY_OWNER"
  alarm_files = fileset("${path.module}/../../../infra/aws/alarms", "[0-9][0-9]-*.json")
  alarm_definitions = {
    for f in local.alarm_files : f => jsondecode(
      replace(
        replace(
          replace(
            replace(
              replace(
                replace(
                  replace(templatefile("${path.module}/../../../infra/aws/alarms/${f}", {}), "__SNS_TOPIC_ARN__", aws_sns_topic.alerts.arn),
                "__SNS_TOPIC_ARN_US_EAST_1__", aws_sns_topic.alerts_us_east_1.arn),
              "__API_HEALTH_CHECK_ID__", aws_route53_health_check.api.id),
            "__ALB_ARN_SUFFIX__", aws_lb.main.arn_suffix),
          "__BACKUP_VAULT_NAME__", aws_backup_vault.production.name),
        "__FIVE_XX_RATE_PERCENT__", "5"),
        "__FIVE_XX_MIN_REQUESTS__", "20"
      )
    )
  }
}

#checkov:skip=CKV2_AWS_11:Option A keeps the network minimal; VPC flow logs are a post-launch account control.
#checkov:skip=CKV2_AWS_12:Option A relies on scoped security groups and does not manage the default group.
resource "aws_vpc" "main" {
  #checkov:skip=CKV2_AWS_11:Option A keeps the network minimal; VPC flow logs are a post-launch account control.
  #checkov:skip=CKV2_AWS_12:Option A relies on scoped security groups and does not manage the default group.
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags                 = { Name = "${local.name}-vpc" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${local.name}-igw" }
}

#checkov:skip=CKV_AWS_130:Option A deliberately assigns public IPs because Fargate tasks run without a NAT gateway.
resource "aws_subnet" "public" {
  #checkov:skip=CKV_AWS_130:Option A deliberately assigns public IPs because Fargate tasks run without a NAT gateway.
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = local.azs[count.index]
  map_public_ip_on_launch = true
  tags                    = { Name = "${local.name}-public-${count.index + 1}" }
}

resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = local.azs[count.index]
  tags              = { Name = "${local.name}-private-${count.index + 1}" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${local.name}-public" }
}
resource "aws_route" "internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.main.id
}
resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${local.name}-private-no-nat" }
}
resource "aws_route_table_association" "private" {
  count          = 2
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

#checkov:skip=CKV_AWS_23:Rules are described where traffic is exposed; the unrestricted egress is required for ALB forwarding.
#checkov:skip=CKV_AWS_260:Port 80 is required solely for the documented HTTP-to-HTTPS redirect.
#checkov:skip=CKV_AWS_382:ALB unrestricted egress is required to reach the API and web target groups.
resource "aws_security_group" "alb" {
  #checkov:skip=CKV_AWS_23:Rules are described where traffic is exposed; the unrestricted egress is required for ALB forwarding.
  #checkov:skip=CKV_AWS_260:Port 80 is required solely for the documented HTTP-to-HTTPS redirect.
  #checkov:skip=CKV_AWS_382:ALB unrestricted egress is required to reach the API and web target groups.
  name   = "${local.name}-alb"
  vpc_id = aws_vpc.main.id
  ingress {
    description = "HTTP redirect"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
#checkov:skip=CKV_AWS_23:The API ingress is restricted to the ALB security group; egress is required for dependencies.
#checkov:skip=CKV_AWS_382:API egress is required for RDS, AWS endpoints, and external identity services in the no-NAT layout.
resource "aws_security_group" "api" {
  #checkov:skip=CKV_AWS_23:The API ingress is restricted to the ALB security group; egress is required for dependencies.
  #checkov:skip=CKV_AWS_382:API egress is required for RDS, AWS endpoints, and external identity services in the no-NAT layout.
  name   = "${local.name}-api"
  vpc_id = aws_vpc.main.id
  ingress {
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
#checkov:skip=CKV_AWS_23:The web ingress is restricted to the ALB security group; egress is required for runtime calls.
#checkov:skip=CKV_AWS_382:Web egress is required for the documented no-NAT Fargate layout.
resource "aws_security_group" "web" {
  #checkov:skip=CKV_AWS_23:The web ingress is restricted to the ALB security group; egress is required for runtime calls.
  #checkov:skip=CKV_AWS_382:Web egress is required for the documented no-NAT Fargate layout.
  name   = "${local.name}-web"
  vpc_id = aws_vpc.main.id
  ingress {
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
#checkov:skip=CKV_AWS_23:The RDS ingress is restricted to the API security group; egress is required by the managed service.
#checkov:skip=CKV_AWS_382:RDS security-group egress follows the managed-service default in Option A.
resource "aws_security_group" "rds" {
  #checkov:skip=CKV_AWS_23:The RDS ingress is restricted to the API security group; egress is required by the managed service.
  #checkov:skip=CKV_AWS_382:RDS security-group egress follows the managed-service default in Option A.
  name   = "${local.name}-rds"
  vpc_id = aws_vpc.main.id
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.api.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_kms_key" "data" {
  description             = "Dari production RDS, Backup and SSM encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  policy                  = jsonencode({ Version = "2012-10-17", Statement = [{ Sid = "Root", Effect = "Allow", Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" }, Action = "kms:*", Resource = "*" }] })
}
resource "aws_kms_alias" "data" {
  name          = "alias/dari-production"
  target_key_id = aws_kms_key.data.key_id
}

resource "aws_db_subnet_group" "rds" {
  name       = "${local.name}-rds"
  subnet_ids = aws_subnet.private[*].id
}
resource "aws_db_parameter_group" "postgres" {
  name   = "${local.name}-postgres16"
  family = "postgres16"
  parameter {
    name         = "rds.force_ssl"
    value        = "1"
    apply_method = "pending-reboot"
  }
}
#checkov:skip=CKV_AWS_118:Enhanced monitoring is outside the db.t4g.micro Option A footprint.
#checkov:skip=CKV_AWS_129:PostgreSQL logs are collected by the API and CloudWatch controls specified in the operations runbook.
#checkov:skip=CKV_AWS_157:Option A explicitly requires a single-AZ RDS instance.
#checkov:skip=CKV_AWS_161:Application authentication is Firebase; database IAM authentication is not part of Option A.
#checkov:skip=CKV_AWS_226:Minor upgrades are applied in the documented maintenance window after review.
#checkov:skip=CKV_AWS_353:Performance Insights is not included in the db.t4g.micro Option A footprint.
resource "aws_db_instance" "dari" {
  #checkov:skip=CKV_AWS_118:Enhanced monitoring is outside the db.t4g.micro Option A footprint.
  #checkov:skip=CKV_AWS_129:PostgreSQL logs are collected by the API and CloudWatch controls specified in the operations runbook.
  #checkov:skip=CKV_AWS_157:Option A explicitly requires a single-AZ RDS instance.
  #checkov:skip=CKV_AWS_161:Application authentication is Firebase; database IAM authentication is not part of Option A.
  #checkov:skip=CKV_AWS_226:Minor upgrades are applied in the documented maintenance window after review.
  #checkov:skip=CKV_AWS_353:Performance Insights is not included in the db.t4g.micro Option A footprint.
  identifier                    = local.name
  engine                        = "postgres"
  engine_version                = "16"
  instance_class                = "db.t4g.micro"
  allocated_storage             = 20
  max_allocated_storage         = 100
  storage_encrypted             = true
  kms_key_id                    = aws_kms_key.data.arn
  username                      = "bootstrap"
  manage_master_user_password   = true
  master_user_secret_kms_key_id = aws_kms_key.data.arn
  db_subnet_group_name          = aws_db_subnet_group.rds.name
  vpc_security_group_ids        = [aws_security_group.rds.id]
  parameter_group_name          = aws_db_parameter_group.postgres.name
  publicly_accessible           = false
  multi_az                      = false
  backup_retention_period       = 35
  backup_window                 = "01:00-01:30"
  maintenance_window            = "sun:02:00-sun:03:00"
  deletion_protection           = true
  skip_final_snapshot           = false
  final_snapshot_identifier     = "dari-final-snapshot"
  delete_automated_backups      = false
  copy_tags_to_snapshot         = true
  apply_immediately             = false
}

resource "aws_s3_bucket" "media" {
  #checkov:skip=CKV_AWS_18:Media access logging is outside the exact Option A resource shape.
  #checkov:skip=CKV_AWS_145:Media uses the documented private SSE configuration; a separate KMS bucket policy is not required.
  #checkov:skip=CKV2_AWS_62:Media has no event-processing requirement in Option A.
  bucket_prefix = "dari-media-"
  force_destroy = false
}
resource "aws_s3_bucket_versioning" "media" {
  bucket = aws_s3_bucket.media.id
  versioning_configuration { status = "Enabled" }
}
resource "aws_s3_bucket_server_side_encryption_configuration" "media" {
  bucket = aws_s3_bucket.media.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}
resource "aws_s3_bucket_public_access_block" "media" {
  bucket                  = aws_s3_bucket.media.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
resource "aws_s3_bucket_lifecycle_configuration" "media" {
  #checkov:skip=CKV_AWS_300:Incomplete uploads are explicitly bounded by the multipart abort rule below.
  bucket = aws_s3_bucket.media.id
  rule {
    id     = "expire-noncurrent"
    status = "Enabled"
    noncurrent_version_expiration { noncurrent_days = 35 }
    abort_incomplete_multipart_upload { days_after_initiation = 7 }
  }
}
resource "aws_cloudfront_origin_access_control" "media" {
  name                              = "dari-media-oac"
  description                       = "Dari private media bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}
#checkov:skip=CKV_AWS_68:Media distribution is intentionally public at the edge while its S3 origin remains private through OAC.
#checkov:skip=CKV_AWS_86:Access logging is a post-launch CloudFront account control for the minimal Option A distribution.
#checkov:skip=CKV_AWS_174:Origin access control is the required media-origin protection; signed URLs are not part of Option A.
#checkov:skip=CKV_AWS_305:Option A uses the documented one-hour TTL and no field-level encryption requirement.
#checkov:skip=CKV_AWS_310:Option A has one media behavior with HTTPS-only access.
#checkov:skip=CKV_AWS_374:CloudFront uses its default certificate because media is served on the distribution hostname.
#checkov:skip=CKV2_AWS_32:Response headers are owned by the web ALB; this distribution serves immutable media objects.
#checkov:skip=CKV2_AWS_42:No custom media hostname is provisioned by Option A.
#checkov:skip=CKV2_AWS_47:WAF is outside the documented Option A shape.
resource "aws_cloudfront_distribution" "media" {
  #checkov:skip=CKV_AWS_68:Media distribution is intentionally public at the edge while its S3 origin remains private through OAC.
  #checkov:skip=CKV_AWS_86:Access logging is a post-launch CloudFront account control for the minimal Option A distribution.
  #checkov:skip=CKV_AWS_174:Origin access control is the required media-origin protection; signed URLs are not part of Option A.
  #checkov:skip=CKV_AWS_305:Option A uses the documented one-hour TTL and no field-level encryption requirement.
  #checkov:skip=CKV_AWS_310:Option A has one media behavior with HTTPS-only access.
  #checkov:skip=CKV_AWS_374:CloudFront uses its default certificate because media is served on the distribution hostname.
  #checkov:skip=CKV2_AWS_32:Response headers are owned by the web ALB; this distribution serves immutable media objects.
  #checkov:skip=CKV2_AWS_42:No custom media hostname is provisioned by Option A.
  #checkov:skip=CKV2_AWS_47:WAF is outside the documented Option A shape.
  enabled = true
  comment = "Dari media; one-hour maximum bounds cached erased-photo visibility"
  origin {
    domain_name              = aws_s3_bucket.media.bucket_regional_domain_name
    origin_id                = "media"
    origin_access_control_id = aws_cloudfront_origin_access_control.media.id
  }
  default_cache_behavior {
    target_origin_id       = "media"
    viewer_protocol_policy = "https-only"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 3600
    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }
  }
  restrictions {
    geo_restriction { restriction_type = "none" }
  }
  viewer_certificate { cloudfront_default_certificate = true }
}
resource "aws_s3_bucket_policy" "media_cloudfront" {
  bucket = aws_s3_bucket.media.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    { Sid = "DenyInsecureTransport", Effect = "Deny", Principal = "*", Action = "s3:*", Resource = [aws_s3_bucket.media.arn, "${aws_s3_bucket.media.arn}/*"], Condition = { Bool = { "aws:SecureTransport" = "false" } } },
    { Sid = "CloudFrontRead", Effect = "Allow", Principal = { Service = "cloudfront.amazonaws.com" }, Action = "s3:GetObject", Resource = "${aws_s3_bucket.media.arn}/*", Condition = { StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.media.arn } } }
  ] })
}

#checkov:skip=CKV_AWS_136:ECR uses the service-managed encryption default; Option A does not provision a second repository KMS policy.
resource "aws_ecr_repository" "api" {
  #checkov:skip=CKV_AWS_136:ECR uses the service-managed encryption default; Option A does not provision a second repository KMS policy.
  name                 = "dari-api"
  image_tag_mutability = "IMMUTABLE"
  force_delete         = false
  image_scanning_configuration { scan_on_push = true }
}
#checkov:skip=CKV_AWS_136:ECR uses the service-managed encryption default; Option A does not provision a second repository KMS policy.
resource "aws_ecr_repository" "web" {
  #checkov:skip=CKV_AWS_136:ECR uses the service-managed encryption default; Option A does not provision a second repository KMS policy.
  name                 = "dari-web"
  image_tag_mutability = "IMMUTABLE"
  force_delete         = false
  image_scanning_configuration { scan_on_push = true }
}
resource "aws_ecr_lifecycle_policy" "api" {
  repository = aws_ecr_repository.api.name
  policy     = jsonencode({ rules = [{ rulePriority = 1, description = "Keep last 20 images", selection = { tagStatus = "any", countType = "imageCountMoreThan", countNumber = 20 }, action = { type = "expire" } }] })
}
resource "aws_ecr_lifecycle_policy" "web" {
  repository = aws_ecr_repository.web.name
  policy     = aws_ecr_lifecycle_policy.api.policy
}

resource "aws_ssm_parameter" "secret" {
  for_each = local.secret_names
  name     = "/dari/production/${lower(replace(each.key, "_", "-"))}"
  type     = "SecureString"
  key_id   = aws_kms_key.data.arn
  value    = local.placeholder
  lifecycle { ignore_changes = [value] }
  tags = { Service = "dari" }
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/dari-api"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.data.arn
}
resource "aws_cloudwatch_log_group" "web" {
  name              = "/ecs/dari-web"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.data.arn
}
#checkov:skip=CKV_AWS_65:Container Insights is disabled to keep the single-task Option A footprint minimal.
resource "aws_ecs_cluster" "main" {
  #checkov:skip=CKV_AWS_65:Container Insights is disabled to keep the single-task Option A footprint minimal.
  name = "dari"
  setting {
    name  = "containerInsights"
    value = "disabled"
  }
}

resource "aws_iam_role" "execution" {
  name               = "dari-ecs-execution"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "ecs-tasks.amazonaws.com" }, Action = "sts:AssumeRole" }] })
}
resource "aws_iam_role_policy" "execution" {
  role = aws_iam_role.execution.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    { Effect = "Allow", Action = ["ecr:GetAuthorizationToken"], Resource = "*" },
    { Effect = "Allow", Action = ["ecr:BatchCheckLayerAvailability", "ecr:GetDownloadUrlForLayer", "ecr:BatchGetImage"], Resource = [aws_ecr_repository.api.arn, aws_ecr_repository.web.arn] },
    { Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = ["${aws_cloudwatch_log_group.api.arn}:*", "${aws_cloudwatch_log_group.web.arn}:*"] },
    { Effect = "Allow", Action = ["ssm:GetParameters"], Resource = [for p in aws_ssm_parameter.secret : p.arn] },
    { Effect = "Allow", Action = ["kms:Decrypt"], Resource = aws_kms_key.data.arn }
  ] })
}
resource "aws_iam_role" "api_task" {
  name               = "dari-api-task"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "ecs-tasks.amazonaws.com" }, Action = "sts:AssumeRole" }] })
}
resource "aws_iam_role_policy" "api_metrics" {
  role   = aws_iam_role.api_task.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Action = ["cloudwatch:PutMetricData"], Resource = "*", Condition = { StringEquals = { "cloudwatch:namespace" = "Dari/Api" } } }] })
}
#checkov:skip=CKV_AWS_273:The documented media integration requires a dedicated IAM user, created without access keys.
resource "aws_iam_user" "media" {
  #checkov:skip=CKV_AWS_273:The documented media integration requires a dedicated IAM user, created without access keys.
  name = "dari-media"
}
#checkov:skip=CKV_AWS_40:The documented media integration requires a narrowly scoped user policy and no keys.
resource "aws_iam_user_policy" "media" {
  #checkov:skip=CKV_AWS_40:The documented media integration requires a narrowly scoped user policy and no keys.
  user   = aws_iam_user.media.name
  policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Action = ["s3:PutObject", "s3:DeleteObject"], Resource = "${aws_s3_bucket.media.arn}/*" }] })
}
#checkov:skip=CKV_AWS_273:The documented SES SMTP integration requires a dedicated IAM user, created without access keys.
resource "aws_iam_user" "ses_smtp" {
  #checkov:skip=CKV_AWS_273:The documented SES SMTP integration requires a dedicated IAM user, created without access keys.
  name = "dari-ses-smtp"
}
#checkov:skip=CKV_AWS_40:The documented SES integration requires a narrowly scoped user policy and no keys.
resource "aws_iam_user_policy" "ses_smtp" {
  #checkov:skip=CKV_AWS_40:The documented SES integration requires a narrowly scoped user policy and no keys.
  user   = aws_iam_user.ses_smtp.name
  policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Action = ["ses:SendRawEmail"], Resource = "arn:aws:ses:${var.region}:${data.aws_caller_identity.current.account_id}:identity/${var.web_domain}", Condition = { StringLike = { "ses:FromAddress" = "*@${var.web_domain}" } } }] })
}

#checkov:skip=CKV_AWS_91:ALB access logging requires a separate log bucket outside the exact Option A resource shape.
#checkov:skip=CKV2_AWS_28:WAF is outside the documented Option A shape.
resource "aws_lb" "main" {
  #checkov:skip=CKV_AWS_91:ALB access logging requires a separate log bucket outside the exact Option A resource shape.
  #checkov:skip=CKV2_AWS_28:WAF is outside the documented Option A shape.
  name                       = "dari"
  load_balancer_type         = "application"
  internal                   = false
  subnets                    = aws_subnet.public[*].id
  security_groups            = [aws_security_group.alb.id]
  drop_invalid_header_fields = true
  enable_deletion_protection = true
}
#checkov:skip=CKV_AWS_378:TLS terminates at the ALB; the private target hop is HTTP as specified by the service ports.
resource "aws_lb_target_group" "api" {
  #checkov:skip=CKV_AWS_378:TLS terminates at the ALB; the private target hop is HTTP as specified by the service ports.
  name                 = "dari-api"
  port                 = 8080
  protocol             = "HTTP"
  vpc_id               = aws_vpc.main.id
  target_type          = "ip"
  deregistration_delay = 45
  health_check {
    path                = "/actuator/health/readiness"
    matcher             = "200"
    protocol            = "HTTP"
    port                = "traffic-port"
    timeout             = 6
    interval            = 30
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}
#checkov:skip=CKV_AWS_378:TLS terminates at the ALB; the private target hop is HTTP as specified by the service ports.
resource "aws_lb_target_group" "web" {
  #checkov:skip=CKV_AWS_378:TLS terminates at the ALB; the private target hop is HTTP as specified by the service ports.
  name                 = "dari-web"
  port                 = 3000
  protocol             = "HTTP"
  vpc_id               = aws_vpc.main.id
  target_type          = "ip"
  deregistration_delay = 45
  health_check {
    path                = "/manifest.webmanifest"
    matcher             = "200"
    protocol            = "HTTP"
    port                = "traffic-port"
    timeout             = 6
    interval            = 30
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

resource "aws_acm_certificate" "main" {
  domain_name               = var.web_domain
  subject_alternative_names = [var.api_domain]
  validation_method         = "DNS"
  lifecycle { create_before_destroy = true }
}
resource "aws_route53_record" "acm" {
  for_each        = var.route53_zone_id == null ? {} : { for d in aws_acm_certificate.main.domain_validation_options : d.domain_name => d }
  zone_id         = var.route53_zone_id
  name            = each.value.resource_record_name
  type            = each.value.resource_record_type
  records         = [each.value.resource_record_value]
  ttl             = 60
  allow_overwrite = true
}
resource "aws_acm_certificate_validation" "main" {
  count                   = var.route53_zone_id == null ? 0 : 1
  certificate_arn         = aws_acm_certificate.main.arn
  validation_record_fqdns = [for r in aws_route53_record.acm : r.fqdn]
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate.main.arn
  default_action {
    type = "fixed-response"
    fixed_response {
      content_type = "text/plain"
      message_body = "Dari host not found"
      status_code  = "404"
    }
  }
}
resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 10
  action {
    type = "forward"
    forward {
      target_group {
        arn = aws_lb_target_group.api.arn
      }
    }
  }
  condition {
    host_header { values = [var.api_domain] }
  }
}
resource "aws_lb_listener_rule" "web" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 20
  action {
    type = "forward"
    forward {
      target_group {
        arn = aws_lb_target_group.web.arn
      }
    }
  }
  condition {
    host_header { values = [var.web_domain] }
  }
}

locals {
  api_environment = [
    { name = "SPRING_PROFILES_ACTIVE", value = "production" },
    { name = "DARI_RELEASE_VERSION", value = var.api_image_tag },
    { name = "DB_URL", value = "jdbc:postgresql://${aws_db_instance.dari.address}:5432/dari" },
    { name = "DARI_WEB_ORIGIN", value = "https://${var.web_domain}" },
    { name = "DARI_TRUSTED_PROXY_IPS", value = var.api_trusted_proxy_ips },
    { name = "DARI_MEDIA_PROVIDER", value = "s3" },
    { name = "DARI_MEDIA_PUBLIC_BASE_URL", value = "https://${aws_cloudfront_distribution.media.domain_name}" },
    { name = "DARI_MEDIA_S3_ENDPOINT", value = "https://s3.${var.region}.amazonaws.com" },
    { name = "DARI_MEDIA_S3_REGION", value = var.region },
    { name = "DARI_MEDIA_S3_BUCKET", value = aws_s3_bucket.media.bucket },
    { name = "SMTP_HOST", value = "email-smtp.${var.region}.amazonaws.com" },
    { name = "SMTP_PORT", value = "587" },
    { name = "FIREBASE_CREDENTIALS_PATH", value = "/run/secrets/firebase/service-account.json" }
  ]
  api_secrets = [for key in ["POSTGRES_USER", "POSTGRES_PASSWORD", "DARI_LOCATION_FUZZ_SECRET", "DARI_SSR_SHARED_SECRET", "DARI_MEDIA_S3_ACCESS_KEY", "DARI_MEDIA_S3_SECRET_KEY", "SMTP_USERNAME", "SMTP_PASSWORD", "DARI_NOTIFICATIONS_FROM", "SENTRY_DSN"] : { name = key, valueFrom = aws_ssm_parameter.secret[key].arn }]
  web_environment = [
    { name = "NEXT_PUBLIC_API_BASE_URL", value = "https://${var.api_domain}/api/v1" },
    { name = "API_BASE_URL", value = "https://${var.api_domain}/api/v1" },
    { name = "NEXT_PUBLIC_SITE_URL", value = "https://${var.web_domain}" },
    { name = "NEXT_PUBLIC_MEDIA_ORIGINS", value = "https://${aws_cloudfront_distribution.media.domain_name}" },
    { name = "NEXT_PUBLIC_RELEASE_VERSION", value = var.web_image_tag },
    { name = "NEXT_PUBLIC_FIREBASE_API_KEY", value = "SET_AT_BUILD_TIME" },
    { name = "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", value = "SET_AT_BUILD_TIME" },
    { name = "NEXT_PUBLIC_FIREBASE_PROJECT_ID", value = "SET_AT_BUILD_TIME" }
  ]
}

resource "aws_ecs_task_definition" "api" {
  family                   = "dari-api"
  cpu                      = 512
  memory                   = 1024
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.api_task.arn
  volume { name = "firebase-secrets" }
  container_definitions = jsonencode([
    { name = "firebase-init", image = "busybox:1.36", essential = false, user = "0", secrets = [{ name = "FIREBASE_JSON", valueFrom = aws_ssm_parameter.secret["FIREBASE_SERVICE_ACCOUNT_JSON"].arn }], mountPoints = [{ sourceVolume = "firebase-secrets", containerPath = "/run/secrets/firebase", readOnly = false }], entryPoint = ["sh", "-c"], command = ["umask 077; mkdir -p /run/secrets/firebase; printf '%s' \"$FIREBASE_JSON\" > /run/secrets/firebase/service-account.json; chown 10001:10001 /run/secrets/firebase/service-account.json; chmod 0400 /run/secrets/firebase/service-account.json"] },
    { name = "api", image = "${aws_ecr_repository.api.repository_url}:${var.api_image_tag}", essential = true, user = "10001", portMappings = [{ containerPort = 8080, protocol = "tcp" }], environment = local.api_environment, secrets = local.api_secrets, mountPoints = [{ sourceVolume = "firebase-secrets", containerPath = "/run/secrets/firebase", readOnly = true }], dependsOn = [{ containerName = "firebase-init", condition = "SUCCESS" }], stopTimeout = 75, healthCheck = { command = ["CMD-SHELL", "curl -fsS http://localhost:8080/actuator/health/liveness || exit 1"], interval = 30, timeout = 5, retries = 3, startPeriod = 120 }, logConfiguration = { logDriver = "awslogs", options = { "awslogs-group" = aws_cloudwatch_log_group.api.name, "awslogs-region" = var.region, "awslogs-stream-prefix" = "api" } } }
  ])
}
resource "aws_ecs_task_definition" "web" {
  family                   = "dari-web"
  cpu                      = 512
  memory                   = var.web_task_memory
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  execution_role_arn       = aws_iam_role.execution.arn
  container_definitions    = jsonencode([{ name = "web", image = "${aws_ecr_repository.web.repository_url}:${var.web_image_tag}", essential = true, portMappings = [{ containerPort = 3000, protocol = "tcp" }], environment = local.web_environment, secrets = [{ name = "DARI_SSR_SHARED_SECRET", valueFrom = aws_ssm_parameter.secret["DARI_SSR_SHARED_SECRET"].arn }], stopTimeout = 75, healthCheck = { command = ["CMD-SHELL", "node -e \"fetch('http://localhost:3000/manifest.webmanifest').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""], interval = 30, timeout = 5, retries = 3, startPeriod = 120 }, logConfiguration = { logDriver = "awslogs", options = { "awslogs-group" = aws_cloudwatch_log_group.web.name, "awslogs-region" = var.region, "awslogs-stream-prefix" = "web" } } }])
}
#checkov:skip=CKV_AWS_333:Option A intentionally assigns public IPs to Fargate tasks because there is no NAT gateway.
resource "aws_ecs_service" "api" {
  #checkov:skip=CKV_AWS_333:Option A intentionally assigns public IPs to Fargate tasks because there is no NAT gateway.
  name                               = "dari-api"
  cluster                            = aws_ecs_cluster.main.id
  task_definition                    = aws_ecs_task_definition.api.arn
  desired_count                      = var.service_desired_count
  launch_type                        = "FARGATE"
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200
  health_check_grace_period_seconds  = 120
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }
  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.api.id]
    assign_public_ip = true
  }
  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 8080
  }
}
#checkov:skip=CKV_AWS_333:Option A intentionally assigns public IPs to Fargate tasks because there is no NAT gateway.
resource "aws_ecs_service" "web" {
  #checkov:skip=CKV_AWS_333:Option A intentionally assigns public IPs to Fargate tasks because there is no NAT gateway.
  name                               = "dari-web"
  cluster                            = aws_ecs_cluster.main.id
  task_definition                    = aws_ecs_task_definition.web.arn
  desired_count                      = var.service_desired_count
  launch_type                        = "FARGATE"
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200
  health_check_grace_period_seconds  = 120
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }
  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.web.id]
    assign_public_ip = true
  }
  load_balancer {
    target_group_arn = aws_lb_target_group.web.arn
    container_name   = "web"
    container_port   = 3000
  }
}

resource "aws_backup_vault" "production" {
  name        = "dari-production"
  kms_key_arn = aws_kms_key.data.arn
}
resource "aws_iam_role" "backup" {
  name               = "dari-backup"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "backup.amazonaws.com" }, Action = "sts:AssumeRole" }] })
}
resource "aws_iam_role_policy_attachment" "backup" {
  role       = aws_iam_role.backup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup"
}
resource "aws_backup_plan" "production" {
  name = "dari-production"
  rule {
    rule_name         = "daily"
    target_vault_name = aws_backup_vault.production.name
    schedule          = "cron(0 3 * * ? *)"
    start_window      = 60
    completion_window = 180
    lifecycle { delete_after = 7 }
    dynamic "copy_action" {
      for_each = var.enable_cross_account_backup_copy && var.backup_destination_vault_arn != null ? [1] : []
      content {
        destination_vault_arn = var.backup_destination_vault_arn
        lifecycle { delete_after = 7 }
      }
    }
  }
  rule {
    rule_name         = "weekly"
    target_vault_name = aws_backup_vault.production.name
    schedule          = "cron(0 4 ? * SUN *)"
    start_window      = 60
    completion_window = 180
    lifecycle { delete_after = 84 }
    dynamic "copy_action" {
      for_each = var.enable_cross_account_backup_copy && var.backup_destination_vault_arn != null ? [1] : []
      content {
        destination_vault_arn = var.backup_destination_vault_arn
        lifecycle { delete_after = 84 }
      }
    }
  }
  rule {
    rule_name         = "monthly"
    target_vault_name = aws_backup_vault.production.name
    schedule          = "cron(0 5 1 * ? *)"
    start_window      = 60
    completion_window = 180
    lifecycle { delete_after = 365 }
    dynamic "copy_action" {
      for_each = var.enable_cross_account_backup_copy && var.backup_destination_vault_arn != null ? [1] : []
      content {
        destination_vault_arn = var.backup_destination_vault_arn
        lifecycle { delete_after = 365 }
      }
    }
  }
}
resource "aws_backup_selection" "rds" {
  name         = "dari-rds"
  plan_id      = aws_backup_plan.production.id
  iam_role_arn = aws_iam_role.backup.arn
  resources    = [aws_db_instance.dari.arn]
}

resource "aws_sns_topic" "alerts" {
  name              = "dari-alerts"
  kms_master_key_id = aws_kms_key.data.arn
}
resource "aws_sns_topic_subscription" "alerts" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}
resource "aws_sns_topic" "alerts_us_east_1" {
  provider          = aws.us_east_1
  name              = "dari-alerts"
  kms_master_key_id = "alias/aws/sns"
}
resource "aws_sns_topic_subscription" "alerts_us_east_1" {
  provider  = aws.us_east_1
  topic_arn = aws_sns_topic.alerts_us_east_1.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

resource "aws_route53_health_check" "api" {
  type              = "HTTPS"
  fqdn              = var.api_domain
  port              = 443
  resource_path     = "/actuator/health/liveness"
  failure_threshold = 3
  request_interval  = 30
}
resource "aws_route53_health_check" "web" {
  type              = "HTTPS"
  fqdn              = var.web_domain
  port              = 443
  resource_path     = "/manifest.webmanifest"
  failure_threshold = 3
  request_interval  = 30
}
resource "aws_route53_record" "web" {
  count   = var.route53_zone_id == null ? 0 : 1
  zone_id = var.route53_zone_id
  name    = var.web_domain
  type    = "A"
  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}
resource "aws_route53_record" "api" {
  count   = var.route53_zone_id == null ? 0 : 1
  zone_id = var.route53_zone_id
  name    = var.api_domain
  type    = "A"
  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

resource "aws_ses_domain_identity" "main" { domain = var.web_domain }
resource "aws_ses_domain_dkim" "main" { domain = aws_ses_domain_identity.main.domain }
resource "aws_route53_record" "ses_dkim" {
  for_each = var.route53_zone_id == null ? toset([]) : toset(aws_ses_domain_dkim.main.dkim_tokens)
  zone_id  = var.route53_zone_id
  name     = "${each.value}._domainkey.${var.web_domain}"
  type     = "CNAME"
  ttl      = 300
  records  = ["${each.value}.dkim.amazonses.com"]
}

resource "aws_budgets_budget" "monthly" {
  name         = "dari-monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_amount)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.alert_email]
  }
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }
}

resource "aws_iam_role" "replication" {
  count              = var.enable_media_replication ? 1 : 0
  name               = "dari-media-replication"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "s3.amazonaws.com" }, Action = "sts:AssumeRole" }] })
}
resource "aws_iam_role_policy" "replication" {
  count  = var.enable_media_replication ? 1 : 0
  role   = aws_iam_role.replication[0].id
  policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Action = ["s3:GetReplicationConfiguration", "s3:ListBucket"], Resource = aws_s3_bucket.media.arn }, { Effect = "Allow", Action = ["s3:GetObjectVersion", "s3:GetObjectVersionAcl", "s3:GetObjectVersionForReplication"], Resource = "${aws_s3_bucket.media.arn}/*" }, { Effect = "Allow", Action = ["s3:ReplicateObject", "s3:ReplicateDelete", "s3:ReplicateTags"], Resource = "${var.replication_destination_bucket_arn}/*" }] })
}
resource "aws_s3_bucket_replication_configuration" "media" {
  count  = var.enable_media_replication ? 1 : 0
  bucket = aws_s3_bucket.media.id
  role   = aws_iam_role.replication[0].arn
  rule {
    id     = "backup-account"
    status = "Enabled"
    filter { prefix = "" }
    destination {
      bucket  = var.replication_destination_bucket_arn
      account = var.backup_account_id
      access_control_translation { owner = "Destination" }
    }
  }
}

resource "aws_cloudwatch_metric_alarm" "api_unreachable" {
  provider            = aws.us_east_1
  alarm_name          = local.alarm_definitions["01-api-unreachable.json"].AlarmName
  alarm_description   = local.alarm_definitions["01-api-unreachable.json"].AlarmDescription
  namespace           = "AWS/Route53"
  metric_name         = "HealthCheckStatus"
  dimensions          = { HealthCheckId = aws_route53_health_check.api.id }
  statistic           = "Minimum"
  period              = 60
  evaluation_periods  = 3
  datapoints_to_alarm = 3
  threshold           = local.alarm_definitions["01-api-unreachable.json"].Threshold
  comparison_operator = "LessThanThreshold"
  treat_missing_data  = "breaching"
  alarm_actions       = [aws_sns_topic.alerts_us_east_1.arn]
  ok_actions          = [aws_sns_topic.alerts_us_east_1.arn]
}
resource "aws_cloudwatch_metric_alarm" "regional" {
  for_each            = { for key, definition in local.alarm_definitions : key => definition if key != "01-api-unreachable.json" }
  alarm_name          = each.value.AlarmName
  alarm_description   = each.value.AlarmDescription
  actions_enabled     = try(each.value.ActionsEnabled, true)
  alarm_actions       = each.value.AlarmActions
  ok_actions          = each.value.OKActions
  namespace           = try(each.value.Namespace, null)
  metric_name         = try(each.value.MetricName, null)
  dimensions          = { for dimension in try(each.value.Dimensions, []) : dimension.Name => dimension.Value }
  statistic           = try(each.value.Statistic, null)
  period              = try(each.value.Period, null)
  evaluation_periods  = each.value.EvaluationPeriods
  datapoints_to_alarm = try(each.value.DatapointsToAlarm, null)
  threshold           = each.value.Threshold
  comparison_operator = each.value.ComparisonOperator
  treat_missing_data  = each.value.TreatMissingData

  dynamic "metric_query" {
    for_each = try(each.value.Metrics, [])
    content {
      id          = metric_query.value.Id
      label       = try(metric_query.value.Label, null)
      return_data = metric_query.value.ReturnData
      expression  = try(metric_query.value.Expression, null)
      dynamic "metric" {
        for_each = try(metric_query.value.MetricStat, null) == null ? [] : [metric_query.value.MetricStat]
        content {
          metric_name = metric.value.Metric.MetricName
          namespace   = metric.value.Metric.Namespace
          period      = metric.value.Period
          stat        = metric.value.Stat
          dimensions  = { for dimension in try(metric.value.Metric.Dimensions, []) : dimension.Name => dimension.Value }
        }
      }
    }
  }
}

