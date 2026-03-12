# Session 2 — Implementation Recap

## Context

Continued AWS Terraform for Phase 1. Goal: add operational storage (DynamoDB), IAM and logging for Ingestion and Aggregator, and Lambda function resources so the stack is ready for deployment once deployment packages exist.

## Implementation Summary

- **DynamoDB tables:** Added `proposals` (partition key `proposal_id`) and `voter_activity` (partition key `voter_pubkey`) in `infra/aws/main.tf`. Billing mode configurable via `dynamodb_billing_mode` (default `PAY_PER_REQUEST`). Aligned with architecture §10.

- **IAM roles:** Ingestion Lambda role (assume Lambda, `sns:Publish` on voting-events topic, CloudWatch Logs to its log group). Aggregator role (assume Lambda, SQS Receive/Delete/GetQueueAttributes on aggregator queue, DynamoDB Get/Put/Update/BatchGet/Query on both tables, CloudWatch Logs). Least-privilege; no wildcards.

- **CloudWatch log groups:** `/aws/lambda/{prefix}-ingestion` and `/aws/lambda/{prefix}-aggregator` with configurable `log_retention_days` (default 14).

- **Lambda resources:** `aws_lambda_function` for Ingestion and Aggregator. Created only when the corresponding zip path variable is non-empty (`ingestion_lambda_zip_path`, `aggregator_lambda_zip_path`), so `terraform plan`/`apply` work without artifacts. Runtime `go1.x`, handler `bootstrap`. Env: Ingestion gets `SNS_TOPIC_ARN`; Aggregator gets `SQS_QUEUE_URL`, `DYNAMODB_PROPOSALS_TABLE`, `DYNAMODB_VOTER_ACTIVITY_TABLE`. Shared `lambda_memory_mb` and `lambda_timeout_seconds` (defaults 256, 60).

- **Event source mapping:** SQS (aggregator queue) triggers Aggregator Lambda; batch size configurable via `lambda_sqs_batch_size` (1–10, default 10). Created only when Aggregator Lambda is created.

- **Variables:** `dynamodb_billing_mode`, `log_retention_days`; `ingestion_lambda_zip_path`, `aggregator_lambda_zip_path` (default `""`); `lambda_memory_mb`, `lambda_timeout_seconds`, `lambda_sqs_batch_size` (with validation).

- **Outputs:** DynamoDB table names; Ingestion and Aggregator role ARNs; `ingestion_lambda_arn` and `aggregator_lambda_arn` (null when the corresponding Lambda is not created).

## Files Touched

- `infra/aws/main.tf`
- `infra/aws/variables.tf`
- `infra/aws/outputs.tf`

## Next Steps

- Implement Aggregator and Ingestion service code (Go); produce deployment zips and set zip path variables for `terraform apply`.
- Optionally add API Gateway (gRPC/gRPC-Web) for Aggregator read API when the gRPC server exists.
