resource "aws_cognito_user_pool" "admin" {
  name                     = "${local.name}-admins"
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]
  password_policy {
    minimum_length    = 12
    require_lowercase = true
    require_uppercase = true
    require_numbers   = true
    require_symbols   = false
  }
  admin_create_user_config { allow_admin_create_user_only = false }
}

resource "aws_cognito_user_pool_client" "web" {
  name                          = "${local.name}-web"
  user_pool_id                  = aws_cognito_user_pool.admin.id
  generate_secret               = false
  prevent_user_existence_errors = "ENABLED"
  explicit_auth_flows           = ["ALLOW_USER_PASSWORD_AUTH", "ALLOW_USER_SRP_AUTH"]
  access_token_validity         = 15
  id_token_validity             = 15
  refresh_token_validity        = 7
  enable_token_revocation       = true
  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }
  refresh_token_rotation {
    feature                    = "ENABLED"
    retry_grace_period_seconds = 30
  }
}

resource "aws_sesv2_email_identity" "invites" {
  email_identity = var.domain_name
}

resource "aws_route53_record" "ses_dkim" {
  count   = 3
  zone_id = var.route53_zone_id
  name    = "${local.ses_dkim_tokens[count.index]}._domainkey.${var.domain_name}"
  type    = "CNAME"
  ttl     = 300
  records = ["${local.ses_dkim_tokens[count.index]}.dkim.amazonses.com"]
}

locals {
  ses_dkim_tokens = sort(tolist(one(aws_sesv2_email_identity.invites.dkim_signing_attributes).tokens))
}

resource "aws_iam_role" "lambda" {
  name = "${local.name}-lambda"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}

resource "aws_iam_role_policy_attachment" "basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}
resource "aws_iam_role_policy_attachment" "vpc" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}
resource "aws_iam_role_policy" "app" {
  name = "${local.name}-app"
  role = aws_iam_role.lambda.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["secretsmanager:GetSecretValue"], Resource = [aws_db_instance.main.master_user_secret[0].secret_arn, "arn:aws:secretsmanager:${var.region}:${data.aws_caller_identity.current.account_id}:secret:${local.name}/session-encryption-??????"] },
      { Effect = "Allow", Action = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"], Resource = "${aws_s3_bucket.media.arn}/*" },
      { Effect = "Allow", Action = ["ses:SendEmail"], Resource = "*" },
    ]
  })
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/lambda/${local.name}-api"
  retention_in_days = 14
}
resource "aws_cloudwatch_log_group" "migrate" {
  name              = "/aws/lambda/${local.name}-migrate"
  retention_in_days = 14
}
resource "aws_cloudwatch_log_group" "media_cleanup" {
  name              = "/aws/lambda/${local.name}-media-cleanup"
  retention_in_days = 14
}

locals {
  lambda_environment = {
    SESSION_ENCRYPTION_SECRET_ID = "${local.name}/session-encryption"
    APP_ENV                      = "production"
    AUTH_MODE                    = "cognito"
    DATABASE_HOST                = aws_db_instance.main.address
    DATABASE_NAME                = aws_db_instance.main.db_name
    DATABASE_SECRET_ARN          = aws_db_instance.main.master_user_secret[0].secret_arn
    NODE_EXTRA_CA_CERTS          = "/var/task/rds-ca.pem"
    COGNITO_USER_POOL_ID         = aws_cognito_user_pool.admin.id
    COGNITO_CLIENT_ID            = aws_cognito_user_pool_client.web.id
    PUBLIC_WEB_URL               = "https://${var.domain_name}"
    MAIL_FROM                    = var.mail_from
    INITIAL_OWNER_EMAIL          = var.initial_owner_email
    MEDIA_STORAGE                = "s3"
    MEDIA_BUCKET                 = aws_s3_bucket.media.bucket
    MEDIA_PUBLIC_URL             = "https://${var.domain_name}/media"
  }
}

resource "aws_lambda_function" "api" {
  function_name                  = "${local.name}-api"
  filename                       = var.lambda_zip_path
  source_code_hash               = filebase64sha256(var.lambda_zip_path)
  handler                        = "lambda.handler"
  runtime                        = "nodejs22.x"
  role                           = aws_iam_role.lambda.arn
  timeout                        = 30
  memory_size                    = 512
  reserved_concurrent_executions = 5
  environment { variables = local.lambda_environment }
  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda.id]
  }
  depends_on = [aws_iam_role_policy_attachment.basic, aws_iam_role_policy_attachment.vpc, aws_iam_role_policy.app, aws_cloudwatch_log_group.api]
}

resource "aws_lambda_function" "migrate" {
  function_name    = "${local.name}-migrate"
  filename         = var.lambda_zip_path
  source_code_hash = filebase64sha256(var.lambda_zip_path)
  handler          = "migrateLambda.handler"
  runtime          = "nodejs22.x"
  role             = aws_iam_role.lambda.arn
  timeout          = 120
  memory_size      = 512
  environment { variables = local.lambda_environment }
  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda.id]
  }
  depends_on = [aws_iam_role_policy_attachment.basic, aws_iam_role_policy_attachment.vpc, aws_iam_role_policy.app, aws_cloudwatch_log_group.migrate]
}

resource "aws_lambda_function" "media_cleanup" {
  function_name    = "${local.name}-media-cleanup"
  filename         = var.lambda_zip_path
  source_code_hash = filebase64sha256(var.lambda_zip_path)
  handler          = "cleanupLambda.handler"
  runtime          = "nodejs22.x"
  role             = aws_iam_role.lambda.arn
  timeout          = 120
  memory_size      = 512
  environment { variables = local.lambda_environment }
  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda.id]
  }
  depends_on = [aws_iam_role_policy_attachment.basic, aws_iam_role_policy_attachment.vpc, aws_iam_role_policy.app, aws_cloudwatch_log_group.media_cleanup]
}

resource "aws_cloudwatch_event_rule" "media_cleanup" {
  name                = "${local.name}-media-cleanup"
  schedule_expression = "rate(1 day)"
}

resource "aws_cloudwatch_event_target" "media_cleanup" {
  rule = aws_cloudwatch_event_rule.media_cleanup.name
  arn  = aws_lambda_function.media_cleanup.arn
}

resource "aws_lambda_permission" "media_cleanup_schedule" {
  statement_id  = "AllowScheduledCleanup"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.media_cleanup.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.media_cleanup.arn
}

resource "aws_apigatewayv2_api" "api" {
  name          = "${local.name}-http"
  protocol_type = "HTTP"
}
resource "aws_apigatewayv2_integration" "api" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
}
resource "aws_apigatewayv2_route" "api" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.api.id}"
}
resource "aws_apigatewayv2_stage" "api" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true
}
resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowApiGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}
