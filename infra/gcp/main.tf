# GCP infrastructure for the chain-to-cloud analytics pipeline.
#
# Phase 2: Forwarder (AWS) publishes to Pub/Sub; Analytics service (Cloud Run)
# consumes events and writes to BigQuery. See architecture.mdc.
#
# Naming convention: project-environment-resource.
# Resources will be added here or via modules under infra/gcp/modules/
# when you have a GCP project.

locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

# TODO: add Pub/Sub topic for voting events (from Forwarder)
# TODO: add BigQuery dataset and tables (votes_raw, proposal_trends)
# TODO: add Cloud Run service for Analytics
# TODO: add service account and least-privilege IAM for Analytics
