# Backend configuration.
#
# Default: local backend so you can run terraform init/validate/plan without
# a GCP project. When you have a GCP project, create a GCS bucket and
# switch to the block below.

terraform {
  backend "local" {
    path = "terraform.tfstate"
  }
}

# Uncomment and fill when you have GCP and want remote state:
#
# terraform {
#   backend "gcs" {
#     bucket = "your-terraform-state-bucket"
#     prefix = "chain-to-cloud/gcp"
#   }
# }
