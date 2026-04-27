variable "env" {
  description = "Environment name prefix for all resources (optional)"
  type        = string
  default     = "team5-dev"
}

variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-2"
}

variable "db_username" {
  description = "RDS master username"
  type        = string
  sensitive   = true
}

variable "db_password" {
  description = "RDS master password"
  type        = string
  sensitive   = true
}

variable "db_name" {
  description = "Initial database name"
  default     = "ratemyprof"
}

variable "alert_email" {
  description = "Email address to receive Lambda error alerts (e.g. a@rit.edu)"
  type        = string
}

variable "nightly_school_id" {
  description = "School ID used by the nightly scheduled analysis event"
  type        = string
  default     = "807"
}

variable "nightly_course_code" {
  description = "Course code used by the nightly scheduled analysis event"
  type        = string
  default     = "SWEN514"
}