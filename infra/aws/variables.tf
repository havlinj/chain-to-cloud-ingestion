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

# Optional: tune for consumer processing time. Defaults are safe for MVP.
variable "sqs_visibility_timeout_seconds" {
  description = "SQS visibility timeout in seconds. Should be >= max processing time per message."
  type        = number
  default     = 30
}

variable "sqs_message_retention_seconds" {
  description = "SQS message retention in seconds (min 60, max 1209600)."
  type        = number
  default     = 345600 # 4 days
}

variable "sqs_dlq_max_receive_count" {
  description = "Number of failed receives before message is sent to DLQ."
  type        = number
  default     = 3
}
