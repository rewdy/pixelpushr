module "platform" {
  source                     = "./modules/platform"
  region                     = var.region
  environment                = var.environment
  domain_name                = var.domain_name
  route53_zone_id            = var.route53_zone_id
  cloudfront_certificate_arn = var.cloudfront_certificate_arn
  mail_from                  = var.mail_from
  lambda_zip_path            = abspath("${path.root}/${var.lambda_zip_path}")
  vpc_cidr                   = var.vpc_cidr
}
