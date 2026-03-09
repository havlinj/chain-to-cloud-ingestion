# AWS infrastructure for the chain-to-cloud voting pipeline.
#
# Event bus (MVP): Ingestion Lambda -> SNS topic -> two SQS queues
# (aggregator, forwarder). Aggregator consumes from its queue; Forwarder
# consumes from its queue. See architecture.mdc §5.
#
# Naming convention: project-environment-resource (e.g. voting-dev-sqs-aggregator).
# Resources will be added here or via modules under infra/aws/modules/
# (lambda, sqs, dynamodb, etc.) when you have an AWS account.

locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

# TODO: add SNS topic (voting-events)
# TODO: add SQS queue for aggregator + subscription to SNS
# TODO: add SQS queue for forwarder + subscription to SNS
# TODO: add Lambda for ingestion (publish to SNS)
# TODO: add Lambda for forwarder (consume from SQS, forward to GCP Pub/Sub in Phase 2)
# TODO: add DynamoDB tables (Proposals, VoterActivity) for Aggregator
# TODO: add IAM roles and least-privilege policies for each service
# TODO: add CloudWatch log groups and alarms as needed
