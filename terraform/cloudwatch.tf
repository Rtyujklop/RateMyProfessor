# ----------------------
# CloudWatch Log Groups (explicit retention instead of "never expire")
# ----------------------

resource "aws_cloudwatch_log_group" "get_professors" {
  name              = "/aws/lambda/${aws_lambda_function.get_professors.function_name}"
  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "professor_analysis_fns" {
  name              = "/aws/lambda/${aws_lambda_function.professor_analysis_fns.function_name}"
  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "get_professor_history" {
  name              = "/aws/lambda/${aws_lambda_function.get_professor_history.function_name}"
  retention_in_days = 14
}

# ----------------------
# EventBridge (CloudWatch Events) — Scheduled Rule
# Triggers professor_analysis_fns every night at midnight UTC
# ----------------------

resource "aws_cloudwatch_event_rule" "nightly_analysis" {
  name                = "${var.env}-nightly-analysis"
  description         = "Trigger professor sentiment re-analysis every night"
  schedule_expression = "cron(0 0 * * ? *)"  # midnight UTC daily
}

resource "aws_cloudwatch_event_target" "nightly_analysis_target" {
  rule      = aws_cloudwatch_event_rule.nightly_analysis.name
  target_id = "professorAnalysisLambda"
  arn       = aws_lambda_function.professor_analysis_fns.arn

  # Pass an API-shaped event so the current Lambda handler routes to get_professors_by_course.
  input = jsonencode({
    pathParameters = {
      schoolId   = var.nightly_school_id
      courseCode = var.nightly_course_code
    }
    requestContext = {
      http = {
        method = "GET"
      }
    }
  })
}

# Allow EventBridge to invoke the Lambda
resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.professor_analysis_fns.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.nightly_analysis.arn
}

# ----------------------
# CloudWatch Alarm — Alert on Lambda errors via SNS
# ----------------------
resource "aws_sns_topic" "lambda_errors" {
  name = "${var.env}-lambda-errors"
}

resource "aws_sns_topic_subscription" "lambda_errors_email" {
  topic_arn = aws_sns_topic.lambda_errors.arn
  protocol  = "email"
  endpoint  = var.alert_email
  confirmation_timeout_in_minutes = 10
}

resource "aws_cloudwatch_metric_alarm" "analysis_lambda_errors" {
  alarm_name          = "${var.env}-analysis-lambda-errors"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 60
  statistic           = "Sum"
  threshold           = 1
  alarm_description   = "Alert when professor_analysis_fns throws an error"
  alarm_actions       = [aws_sns_topic.lambda_errors.arn]

  dimensions = {
    FunctionName = aws_lambda_function.professor_analysis_fns.function_name
  }
}