# API Gateway

output "api_endpoint" {
  description = "Base URL of the HTTP API Gateway"
  value       = aws_apigatewayv2_api.http_api.api_endpoint
}

output "get_professors_url" {
  description = "GET endpoint — replace {schoolId} with the actual school ID"
  value       = "${aws_apigatewayv2_api.http_api.api_endpoint}/schools/{schoolId}/professors"
}

output "post_professor_url" {
  description = "POST endpoint — replace {professorId} with the actual professor ID"
  value       = "${aws_apigatewayv2_api.http_api.api_endpoint}/professors/{professorId}/analyze"
}

output "get_professor_history_url" {
  description = "GET endpoint — replace {professorId} with the actual professor ID"
  value       = "${aws_apigatewayv2_api.http_api.api_endpoint}/professors/{professorId}/history"
}

# S3

output "s3_bucket_name" {
  description = "Name of the S3 bucket"
  value       = aws_s3_bucket.app_bucket.bucket
}

output "s3_website_url" {
  description = "Public URL to access the hosted frontend"
  value       = aws_s3_bucket_website_configuration.frontend.website_endpoint
}

# RDS

output "rds_endpoint" {
  description = "RDS connection endpoint (host:port)"
  value       = aws_db_instance.db.endpoint
}

output "rds_address" {
  description = "RDS hostname (without port)"
  value       = aws_db_instance.db.address
}
