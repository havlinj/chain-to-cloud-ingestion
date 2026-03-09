# Placeholder outputs. Add real outputs when you create resources
# (e.g. sqs_queue_url, sns_topic_arn, lambda_function_name).

output "environment" {
  description = "Current environment."
  value       = var.environment
}

output "region" {
  description = "AWS region."
  value       = var.region
}

output "name_prefix" {
  description = "Prefix for resource names: project-environment."
  value       = "${var.project_name}-${var.environment}"
}
