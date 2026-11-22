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

resource "aws_acm_certificate" "site" {
  provider          = aws.cloudfront
  domain_name       = local.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "certificate_validation" {
  zone_id = data.aws_route53_zone.site.zone_id
  name    = one(aws_acm_certificate.site.domain_validation_options).resource_record_name
  type    = "CNAME"
  records = [one(aws_acm_certificate.site.domain_validation_options).resource_record_value]
  ttl     = 60
}

resource "aws_acm_certificate_validation" "site" {
  provider                = aws.cloudfront
  certificate_arn         = aws_acm_certificate.site.arn
  validation_record_fqdns = [aws_route53_record.certificate_validation.fqdn]

  timeouts {
    create = "30m"
  }
}

module "platform" {
  source                     = "./modules/platform"
  region                     = local.region
  environment                = local.environment
  domain_name                = local.domain_name
  route53_zone_id            = data.aws_route53_zone.site.zone_id
  cloudfront_certificate_arn = aws_acm_certificate_validation.site.certificate_arn
  mail_from                  = local.mail_from
  initial_owner_email        = local.initial_owner_email
  lambda_zip_path            = local.lambda_zip_path
  vpc_cidr                   = local.vpc_cidr
}
