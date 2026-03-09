variable "region" {
  description = "AWS region for all resources."
  type        = string
  default     = "eu-west-1"
}

variable "environment" {
  description = "Environment name (e.g. dev, staging, prod). Used in naming and tags."
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of: dev, staging, prod."
  }
}

variable "project_name" {
  description = "Project name used in resource naming (e.g. voting)."
  type        = string
  default     = "voting"
}
