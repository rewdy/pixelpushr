output "web_url" { value = "https://${var.domain_name}" }
output "api_health_url" { value = "https://${var.domain_name}/api/health" }
output "media_bucket" { value = aws_s3_bucket.media.bucket }
output "web_bucket" { value = aws_s3_bucket.web.bucket }
output "cloudfront_distribution_id" { value = aws_cloudfront_distribution.web.id }
output "migration_lambda_name" { value = aws_lambda_function.migrate.function_name }
output "cognito_user_pool_id" { value = aws_cognito_user_pool.admin.id }
