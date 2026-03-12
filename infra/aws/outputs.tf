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

output "dynamodb_proposals_table_name" {
  description = "Name of the Proposals DynamoDB table."
  value       = aws_dynamodb_table.proposals.name
}

output "dynamodb_voter_activity_table_name" {
  description = "Name of the VoterActivity DynamoDB table."
  value       = aws_dynamodb_table.voter_activity.name
}

output "ingestion_lambda_role_arn" {
  description = "ARN of the IAM role for the Ingestion Lambda."
  value       = aws_iam_role.ingestion_lambda.arn
}

output "aggregator_role_arn" {
  description = "ARN of the IAM role for the Aggregator (Lambda or ECS)."
  value       = aws_iam_role.aggregator.arn
}

output "ingestion_lambda_arn" {
  description = "ARN of the Ingestion Lambda (null if not deployed)."
  value       = length(aws_lambda_function.ingestion) > 0 ? aws_lambda_function.ingestion[0].arn : null
}

output "aggregator_lambda_arn" {
  description = "ARN of the Aggregator Lambda (null if not deployed)."
  value       = length(aws_lambda_function.aggregator) > 0 ? aws_lambda_function.aggregator[0].arn : null
}
