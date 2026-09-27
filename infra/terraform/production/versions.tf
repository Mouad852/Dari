terraform {
  required_version = "= 1.16.4"

  backend "s3" {
    key          = "dari/production.tfstate"
    use_lockfile = true
    encrypt      = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "= 6.65.0"
    }
  }
}

provider "aws" {
  region = var.region
}

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}
