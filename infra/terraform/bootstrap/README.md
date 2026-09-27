# Terraform state bootstrap

This stack is applied once with a locally reviewed AWS account. It creates the
versioned, encrypted, private S3 bucket used by the production backend. The
production stack uses native S3 locking (`use_lockfile = true`); DynamoDB
locking is intentionally not provisioned because it is deprecated.

The owner supplies the region and globally unique bucket name, then initializes
`infra/terraform/production` with `-backend-config="bucket=<output>"` and
`-backend-config="region=<region>"`. Do not destroy this bucket.

