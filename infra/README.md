# Infrastructure — Chain-to-Cloud Voting

Terraform for AWS (operational pipeline) and GCP (analytics). Each cloud has its own directory and state.

## Structure

- **infra/aws/** — Lambda, SNS, SQS, DynamoDB, IAM, CloudWatch (ingestion, event bus, aggregator).
- **infra/gcp/** — Pub/Sub, BigQuery, Cloud Run, IAM (forwarder target, analytics).
- **infra/aws/modules/** — Reusable AWS modules (lambda, sqs, dynamodb, etc.) when you add real resources.
- **infra/gcp/modules/** — Reusable GCP modules (cloudrun, pubsub, bigquery, etc.) when you add real resources.

## Running Without a Cloud Account

Both stacks use a **local backend** by default so you can:

- Run `terraform init`, `terraform fmt`, and `terraform validate` without any cloud account.
- Run `terraform plan` for AWS with default or example tfvars (no resources created yet; plan shows no changes or minimal changes).
- For GCP `plan` you must pass `project_id` (e.g. `-var="project_id=your-project"` or use a tfvars file).

When you have an AWS account:

1. Create an S3 bucket and DynamoDB table for state (see [Terraform S3 backend](https://developer.hashicorp.com/terraform/language/settings/backends/s3)).
2. In **infra/aws/backend.tf**, switch from `backend "local"` to the commented `backend "s3"` block and set `bucket`, `key`, `region`, and `dynamodb_table`.
3. Run `terraform init -reconfigure` and then `plan` / `apply` as needed.

When you have a GCP project:

1. Create a GCS bucket for state.
2. In **infra/gcp/backend.tf**, switch to the commented `backend "gcs"` block and set `bucket` and `prefix`.
3. Run `terraform init -reconfigure` and use a tfvars file or variables for `project_id`, then `plan` / `apply`.

## Conventions

- **Environments:** `dev`, `staging`, `prod` (set via `var.environment`).
- **Naming:** `project-environment-resource` (e.g. `voting-dev-sqs-aggregator`). See `.cursor/rules/terraform_style.mdc`.
- **State:** Remote backend (S3 + DynamoDB for AWS, GCS for GCP) when you have accounts; local for skeleton only.
- **IAM:** Least privilege only; no wildcard actions or resource ARNs.

## Quick Commands

```bash
# AWS (from repo root)
cd infra/aws
terraform init
terraform fmt -recursive
terraform validate
terraform plan -var="environment=dev"   # optional: -var-file=dev.tfvars

# GCP (from repo root)
cd infra/gcp
terraform init
terraform fmt -recursive
terraform validate
terraform plan -var="environment=dev" -var="project_id=YOUR_PROJECT_ID"   # or -var-file=dev.tfvars
```

## References

- **Architecture:** `.cursor/rules/architecture.mdc` (§5 event bus, §10 data storage).
- **Terraform rules:** `.cursor/rules/terraform_style.mdc`.
- **Service boundaries:** `.cursor/rules/service_boundaries.mdc`.
