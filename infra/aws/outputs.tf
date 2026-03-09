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

output "sns_topic_arn" {
  description = "ARN of the voting-events SNS topic (for Ingestion Lambda)."
  value       = aws_sns_topic.voting_events.arn
}

output "sqs_aggregator_queue_url" {
  description = "URL of the Aggregator SQS queue."
  value       = aws_sqs_queue.aggregator.url
}

output "sqs_forwarder_queue_url" {
  description = "URL of the Forwarder SQS queue."
  value       = aws_sqs_queue.forwarder.url
}

output "sqs_aggregator_dlq_url" {
  description = "URL of the Aggregator DLQ."
  value       = aws_sqs_queue.aggregator_dlq.url
}

output "sqs_forwarder_dlq_url" {
  description = "URL of the Forwarder DLQ."
  value       = aws_sqs_queue.forwarder_dlq.url
}
