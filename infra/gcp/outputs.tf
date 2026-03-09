# Placeholder outputs. Add real outputs when you create resources
# (e.g. pubsub_topic_name, bigquery_dataset_id, cloud_run_service_url).

output "environment" {
  description = "Current environment."
  value       = var.environment
}

output "region" {
  description = "GCP region."
  value       = var.region
}

output "name_prefix" {
  description = "Prefix for resource names: project-environment."
  value       = "${var.project_name}-${var.environment}"
}
