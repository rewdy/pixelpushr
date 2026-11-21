terraform {
  required_version = ">= 1.10.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 6.0" }
  }
  backend "s3" {
    bucket              = "drewmey--devops-tf-state"
    key                 = "pixelpushr/production.tfstate"
    region              = "us-east-1"
    encrypt             = true
    use_lockfile        = true
    allowed_account_ids = ["390847857761"]
  }
}

provider "aws" {
  region = local.region
  default_tags { tags = { Project = "pixelpushr", Environment = local.environment } }
}

provider "aws" {
  alias  = "cloudfront"
  region = "us-east-1"
}
