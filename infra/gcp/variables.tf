variable "project_id" {
  description = "GCP project ID."
  type        = string
}

variable "region" {
  description = "GCP region for regional resources."
  type        = string
  default     = "europe-west1"
}

variable "environment" {
  description = "Environment name (e.g. dev, staging, prod). Used in naming and labels."
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
