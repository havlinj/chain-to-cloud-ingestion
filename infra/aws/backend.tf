# Backend configuration.
#
# Default: local backend so you can run terraform init/validate/plan without
# an AWS account. When you have an AWS account, create an S3 bucket and
# DynamoDB table for state locking, then switch to the block below (or use
# -backend-config in CI).

terraform {
  backend "local" {
    path = "terraform.tfstate"
  }
}

# Uncomment and fill when you have AWS and want remote state:
#
# terraform {
#   backend "s3" {
#     bucket         = "your-terraform-state-bucket"
#     key            = "chain-to-cloud/aws/terraform.tfstate"
#     region         = "eu-west-1"
#     dynamodb_table = "your-terraform-locks"
#     encrypt        = true
#   }
# }
