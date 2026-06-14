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

variable "dynamodb_billing_mode" {
  description = "DynamoDB billing mode: PAY_PER_REQUEST or PROVISIONED."
  type        = string
  default     = "PAY_PER_REQUEST"

  validation {
    condition     = contains(["PAY_PER_REQUEST", "PROVISIONED"], var.dynamodb_billing_mode)
    error_message = "dynamodb_billing_mode must be PAY_PER_REQUEST or PROVISIONED."
  }
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days for Lambda log groups."
  type        = number
  default     = 14
}

# Lambda deployment packages. Leave empty to skip creating the Lambda resources (e.g. until first build).
variable "ingestion_lambda_zip_path" {
  description = "Path to the Ingestion Lambda deployment zip (Node.js bundle). Empty string = do not create the Lambda."
  type        = string
  default     = ""
}

variable "solana_rpc_url" {
  description = "Solana RPC URL for the Ingestion Lambda. Leave empty until the Lambda is deployed."
  type        = string
  default     = ""
  sensitive   = true
}

variable "solana_program_id" {
  description = "Deployed voting program public key for the Ingestion Lambda."
  type        = string
  default     = ""
}

variable "ingestion_lookback_slots" {
  description = "How many recent slots the Ingestion Lambda scans per invocation."
  type        = number
  default     = 50

  validation {
    condition     = var.ingestion_lookback_slots > 0
    error_message = "ingestion_lookback_slots must be greater than 0."
  }
}

variable "ingestion_event_source" {
  description = "Value for the event source field added by Ingestion."
  type        = string
  default     = "voting-contract"
}

variable "ingestion_event_version" {
  description = "Event schema version written by Ingestion."
  type        = number
  default     = 1

  validation {
    condition     = var.ingestion_event_version > 0
    error_message = "ingestion_event_version must be greater than 0."
  }
}

variable "aggregator_lambda_zip_path" {
  description = "Path to the Aggregator Lambda deployment zip (Go binary). Empty string = do not create the Lambda."
  type        = string
  default     = ""
}

variable "lambda_memory_mb" {
  description = "Memory size in MB for Ingestion and Aggregator Lambdas."
  type        = number
  default     = 256
}

variable "lambda_timeout_seconds" {
  description = "Timeout in seconds for Ingestion and Aggregator Lambdas."
  type        = number
  default     = 60
}

variable "lambda_sqs_batch_size" {
  description = "SQS batch size for Aggregator Lambda event source mapping (1–10)."
  type        = number
  default     = 10

  validation {
    condition     = var.lambda_sqs_batch_size >= 1 && var.lambda_sqs_batch_size <= 10
    error_message = "lambda_sqs_batch_size must be between 1 and 10."
  }
}

variable "ingestion_schedule_enabled" {
  description = "Create an EventBridge schedule to invoke the Ingestion Lambda. Requires ingestion_lambda_zip_path."
  type        = bool
  default     = true
}

variable "ingestion_schedule_minutes" {
  description = "EventBridge rate interval in minutes for Ingestion Lambda polling."
  type        = number
  default     = 1

  validation {
    condition     = var.ingestion_schedule_minutes >= 1
    error_message = "ingestion_schedule_minutes must be at least 1."
  }
}
