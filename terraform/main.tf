# ----------------------
# S3 Bucket
# ----------------------

resource "aws_s3_bucket" "app_bucket" {
  bucket = "${var.env}-ratemyprof-raw-ratings"
  force_destroy = true
}

resource "aws_s3_bucket_website_configuration" "frontend" {
  bucket = aws_s3_bucket.app_bucket.id
  index_document {
    suffix = "index.html"
  }
  error_document {
    key = "index.html"
  }
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.app_bucket.id
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "frontend_public_read" {
  bucket = aws_s3_bucket.app_bucket.id
  depends_on = [aws_s3_bucket_public_access_block.frontend]
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "PublicReadGetObject"
      Effect    = "Allow"
      Principal = "*"
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.app_bucket.arn}/*"
    }]
  })
}

# ----------------------
# IAM Role for Lambda
# ----------------------

resource "aws_iam_role" "lambda_exec" {
  name = "${var.env}-lambda-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda_rmp_policy" {
  name = "${var.env}-lambda-rmp-policy"
  role = aws_iam_role.lambda_exec.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject"
        ]
        Resource = "arn:aws:s3:::${aws_s3_bucket.app_bucket.bucket}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "comprehend:DetectSentiment",
          "comprehend:BatchDetectSentiment"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = ["sns:Publish"]
        Resource = aws_sns_topic.lambda_errors.arn
      }
    ]
  })
}

# ----------------------
# Lambda Functions
# ----------------------

resource "aws_lambda_function" "get_professors" {
  function_name = "${var.env}-get-professors"
  role          = aws_iam_role.lambda_exec.arn
  runtime       = "python3.11"
  handler       = "lambda_function.lambda_handler"
  filename         = "${path.module}/../lambdas/getProfessors/getProfessors.zip"
  source_code_hash = filebase64sha256("${path.module}/../lambdas/getProfessors/getProfessors.zip")
  environment {
    variables = {
      DB_HOST = aws_db_instance.db.address
      DB_PORT = aws_db_instance.db.port
      DB_NAME = var.db_name
      DB_USER = var.db_username
      DB_PASS = var.db_password
      ENV     = var.env
    }
  }
  depends_on = [aws_iam_role_policy_attachment.lambda_basic]
  layers     = [aws_lambda_layer_version.lxml.arn]
  timeout    = 60
}

resource "aws_lambda_function" "professor_analysis_fns" {
  function_name = "${var.env}-professor-analysis-fns"
  role          = aws_iam_role.lambda_exec.arn
  runtime       = "python3.11"
  handler       = "lambda_function.lambda_handler"
  filename         = "${path.module}/../lambdas/professorAnalysisFns/professorAnalysisFns.zip"
  source_code_hash = filebase64sha256("${path.module}/../lambdas/professorAnalysisFns/professorAnalysisFns.zip")
  environment {
    variables = {
      DB_HOST = aws_db_instance.db.address
      DB_PORT = aws_db_instance.db.port
      DB_NAME = var.db_name
      DB_USER = var.db_username
      DB_PASS = var.db_password
      ENV     = var.env
      S3_BUCKET = aws_s3_bucket.app_bucket.bucket
    }
  }
  depends_on = [aws_iam_role_policy_attachment.lambda_basic]
  layers     = [aws_lambda_layer_version.lxml.arn]
  timeout    = 60
}

resource "aws_lambda_function" "get_professor_history" {
  function_name = "${var.env}-get-professor-history"
  role          = aws_iam_role.lambda_exec.arn
  runtime       = "python3.11"
  handler       = "lambda_function.lambda_handler"
  filename         = "${path.module}/../lambdas/getProfessorHistory/getProfessorHistory.zip"
  source_code_hash = filebase64sha256("${path.module}/../lambdas/getProfessorHistory/getProfessorHistory.zip")
  environment {
    variables = {
      DB_HOST = aws_db_instance.db.address
      DB_PORT = aws_db_instance.db.port
      DB_NAME = var.db_name
      DB_USER = var.db_username
      DB_PASS = var.db_password
      ENV     = var.env
    }
  }
  depends_on = [aws_iam_role_policy_attachment.lambda_basic]
  layers     = [aws_lambda_layer_version.lxml.arn]
  timeout    = 60
}

resource "aws_lambda_layer_version" "lxml" {
  layer_name = "lxml-layer"
  compatible_runtimes = ["python3.11"]
  filename         = "${path.module}/../lambdas/lxml-layer.zip"
  source_code_hash = filebase64sha256("${path.module}/../lambdas/lxml-layer.zip")
}

# ----------------------
# API Gateway
# ----------------------

resource "aws_apigatewayv2_api" "http_api" {
  name          = "${var.env}-rmp-api"
  protocol_type = "HTTP"
  cors_configuration {
    allow_headers = ["Content-Type", "Authorization"]
    allow_methods = ["GET", "POST", "OPTIONS"]
    allow_origins = ["*"]
    max_age       = 300
  }
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http_api.id
  name        = "$default"
  auto_deploy = true
}

# ----------------------
# Lambda Integrations
# ----------------------

resource "aws_apigatewayv2_integration" "get_professors_integration" {
  api_id                 = aws_apigatewayv2_api.http_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.get_professors.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "professor_analysis_integration" {
  api_id                 = aws_apigatewayv2_api.http_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.professor_analysis_fns.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "get_professor_history_integration" {
  api_id                 = aws_apigatewayv2_api.http_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.get_professor_history.invoke_arn
  payload_format_version = "2.0"
}

# ----------------------
# API Routes
# ----------------------

resource "aws_apigatewayv2_route" "get_professors" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "GET /schools/{schoolId}/professors"
  target    = "integrations/${aws_apigatewayv2_integration.get_professors_integration.id}"
}

resource "aws_apigatewayv2_route" "post_analyze" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "POST /professors/{professorId}/analyze"
  target    = "integrations/${aws_apigatewayv2_integration.professor_analysis_integration.id}"
}

resource "aws_apigatewayv2_route" "get_professors_by_course" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "GET /schools/{schoolId}/courses/{courseCode}/professors"
  target    = "integrations/${aws_apigatewayv2_integration.professor_analysis_integration.id}"
}

resource "aws_apigatewayv2_route" "get_professor_history" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "GET /professors/{professorId}/history"
  target    = "integrations/${aws_apigatewayv2_integration.get_professor_history_integration.id}"
}

# ----------------------
# Lambda Permissions
# ----------------------

resource "aws_lambda_permission" "allow_get" {
  statement_id  = "AllowAPIGatewayInvokeGet"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get_professors.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "allow_post" {
  statement_id  = "AllowAPIGatewayInvokePost"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.professor_analysis_fns.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "allow_get_history" {
  statement_id  = "AllowAPIGatewayInvokeGetHistory"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get_professor_history.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}

# ----------------------
# RDS (MySQL)
# ----------------------

data "aws_subnets" "default" {
  filter {
    name   = "defaultForAz"
    values = ["true"]
  }
}

resource "aws_db_subnet_group" "default" {
  name       = "${var.env}-db-subnet-group"
  subnet_ids = data.aws_subnets.default.ids
}

data "aws_vpc" "default" {
  default = true
}

resource "aws_security_group" "rds_sg" {
  name        = "${var.env}-rds-group"
  description = "Allow MySQL access from within the VPC"
  vpc_id      = data.aws_vpc.default.id
  ingress {
    from_port   = 3306
    to_port     = 3306
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_db_instance" "db" {
  identifier     = "${var.env}-ratemyprof-db"
  engine         = "mysql"
  engine_version = "8.4.7"
  instance_class = "db.t3.micro"
  allocated_storage      = 20
  username               = var.db_username
  password               = var.db_password
  db_name                = var.db_name
  db_subnet_group_name   = aws_db_subnet_group.default.name
  vpc_security_group_ids = [aws_security_group.rds_sg.id]
  publicly_accessible = true
  skip_final_snapshot = true
}

resource "null_resource" "init_db" {
  depends_on = [aws_db_instance.db]
  triggers = {
    db_instance = aws_db_instance.db.id
    schema_hash = filemd5("${path.module}/../db/schema.sql")
    seed_hash   = filemd5("${path.module}/../db/db_seed.sql")
  }

  // Apply schema, then seed data
  provisioner "local-exec" {
    command = <<EOT
mysql -h ${aws_db_instance.db.address} \
-u ${var.db_username} \
-p${var.db_password} \
${var.db_name} < ${path.module}/../db/schema.sql

mysql -h ${aws_db_instance.db.address} \
-u ${var.db_username} \
-p${var.db_password} \
${var.db_name} < ${path.module}/../db/db_seed.sql
EOT
  }
}
