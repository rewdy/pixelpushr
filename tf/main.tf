locals {
  region              = "us-east-1"
  environment         = "production"
  domain_name         = "pixelpushr.app"
  mail_from           = "invites@${local.domain_name}"
  initial_owner_email = "andrew.meyer@walnutcreekchurch.org"
  lambda_zip_path     = abspath("${path.root}/../artifacts/lambda.zip")
  vpc_cidr            = "10.84.0.0/16"
}

data "aws_route53_zone" "site" {
  name         = "${local.domain_name}."
  private_zone = false
}

data "aws_acm_certificate" "site" {
  provider    = aws.cloudfront
  domain      = local.domain_name
  statuses    = ["ISSUED"]
  most_recent = true
}

module "platform" {
  source                     = "./modules/platform"
  region                     = local.region
  environment                = local.environment
  domain_name                = local.domain_name
  route53_zone_id            = data.aws_route53_zone.site.zone_id
  cloudfront_certificate_arn = data.aws_acm_certificate.site.arn
  mail_from                  = local.mail_from
  initial_owner_email        = local.initial_owner_email
  lambda_zip_path            = local.lambda_zip_path
  vpc_cidr                   = local.vpc_cidr
}
