variable "region" { type = string }
variable "environment" { type = string }
variable "domain_name" { type = string }
variable "route53_zone_id" { type = string }
variable "cloudfront_certificate_arn" { type = string }
variable "mail_from" { type = string }
variable "lambda_zip_path" {
  type    = string
  default = "../artifacts/lambda.zip"
}
variable "vpc_cidr" {
  type    = string
  default = "10.84.0.0/16"
}
