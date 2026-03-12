# AWS infrastructure for the chain-to-cloud voting pipeline.
#
# Event bus (MVP): Ingestion Lambda -> SNS topic -> two SQS queues
# (aggregator, forwarder). Aggregator consumes from its queue; Forwarder
# consumes from its queue. See architecture.mdc §5.
#
# Naming convention: project-environment-resource (e.g. voting-dev-sqs-aggregator).

locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

# ------------------------------------------------------------------------------
# SNS topic (voting-events): fan-out to Aggregator and Forwarder queues
# ------------------------------------------------------------------------------

resource "aws_sns_topic" "voting_events" {
  name = "${local.name_prefix}-voting-events"
}

# ------------------------------------------------------------------------------
# SQS: Aggregator queue + DLQ
# ------------------------------------------------------------------------------

resource "aws_sqs_queue" "aggregator_dlq" {
  name                      = "${local.name_prefix}-sqs-aggregator-dlq"
  message_retention_seconds = var.sqs_message_retention_seconds
}

resource "aws_sqs_queue" "aggregator" {
  name                       = "${local.name_prefix}-sqs-aggregator"
  visibility_timeout_seconds = var.sqs_visibility_timeout_seconds
  message_retention_seconds  = var.sqs_message_retention_seconds
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.aggregator_dlq.arn
    maxReceiveCount     = var.sqs_dlq_max_receive_count
  })
}

resource "aws_sns_topic_subscription" "aggregator" {
  topic_arn = aws_sns_topic.voting_events.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.aggregator.arn
}

resource "aws_sqs_queue_policy" "aggregator" {
  queue_url = aws_sqs_queue.aggregator.id
  policy    = data.aws_iam_policy_document.aggregator_sns_publish.json
}

data "aws_iam_policy_document" "aggregator_sns_publish" {
  statement {
    sid    = "AllowSNSPublish"
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["sns.amazonaws.com"]
    }
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.aggregator.arn]
    condition {
      test     = "ArnEquals"
      variable = "aws:SourceArn"
      values   = [aws_sns_topic.voting_events.arn]
    }
  }
}

# ------------------------------------------------------------------------------
# SQS: Forwarder queue + DLQ
# ------------------------------------------------------------------------------

resource "aws_sqs_queue" "forwarder_dlq" {
  name                      = "${local.name_prefix}-sqs-forwarder-dlq"
  message_retention_seconds = var.sqs_message_retention_seconds
}

resource "aws_sqs_queue" "forwarder" {
  name                       = "${local.name_prefix}-sqs-forwarder"
  visibility_timeout_seconds = var.sqs_visibility_timeout_seconds
  message_retention_seconds  = var.sqs_message_retention_seconds
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.forwarder_dlq.arn
    maxReceiveCount     = var.sqs_dlq_max_receive_count
  })
}

resource "aws_sns_topic_subscription" "forwarder" {
  topic_arn = aws_sns_topic.voting_events.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.forwarder.arn
}

resource "aws_sqs_queue_policy" "forwarder" {
  queue_url = aws_sqs_queue.forwarder.id
  policy    = data.aws_iam_policy_document.forwarder_sns_publish.json
}

data "aws_iam_policy_document" "forwarder_sns_publish" {
  statement {
    sid    = "AllowSNSPublish"
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["sns.amazonaws.com"]
    }
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.forwarder.arn]
    condition {
      test     = "ArnEquals"
      variable = "aws:SourceArn"
      values   = [aws_sns_topic.voting_events.arn]
    }
  }
}

# ------------------------------------------------------------------------------
# DynamoDB: operational projection (Aggregator)
# See architecture.mdc §10.
# ------------------------------------------------------------------------------

resource "aws_dynamodb_table" "proposals" {
  name         = "${local.name_prefix}-proposals"
  billing_mode = var.dynamodb_billing_mode
  hash_key     = "proposal_id"

  attribute {
    name = "proposal_id"
    type = "S"
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_dynamodb_table" "voter_activity" {
  name         = "${local.name_prefix}-voter-activity"
  billing_mode = var.dynamodb_billing_mode
  hash_key     = "voter_pubkey"

  attribute {
    name = "voter_pubkey"
    type = "S"
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# ------------------------------------------------------------------------------
# IAM: Ingestion Lambda (publish to SNS, write logs)
# ------------------------------------------------------------------------------

resource "aws_iam_role" "ingestion_lambda" {
  name = "${local.name_prefix}-ingestion-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

data "aws_iam_policy_document" "ingestion_lambda" {
  statement {
    sid    = "SNSPublish"
    effect = "Allow"
    actions = [
      "sns:Publish"
    ]
    resources = [aws_sns_topic.voting_events.arn]
  }

  statement {
    sid    = "CloudWatchLogs"
    effect = "Allow"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ]
    resources = ["${aws_cloudwatch_log_group.ingestion.arn}:*"]
  }
}

resource "aws_iam_role_policy" "ingestion_lambda" {
  name   = "ingestion-lambda-policy"
  role   = aws_iam_role.ingestion_lambda.id
  policy = data.aws_iam_policy_document.ingestion_lambda.json
}

# ------------------------------------------------------------------------------
# IAM: Aggregator (consume SQS, read/write DynamoDB, write logs)
# Assumable by Lambda or ECS; adjust trust when deployment target is chosen.
# ------------------------------------------------------------------------------

resource "aws_iam_role" "aggregator" {
  name = "${local.name_prefix}-aggregator-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

data "aws_iam_policy_document" "aggregator" {
  statement {
    sid    = "SQSReceive"
    effect = "Allow"
    actions = [
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes"
    ]
    resources = [aws_sqs_queue.aggregator.arn]
  }

  statement {
    sid    = "DynamoDBProposals"
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:BatchGetItem",
      "dynamodb:Query"
    ]
    resources = [
      aws_dynamodb_table.proposals.arn
    ]
  }

  statement {
    sid    = "DynamoDBVoterActivity"
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:BatchGetItem",
      "dynamodb:Query"
    ]
    resources = [
      aws_dynamodb_table.voter_activity.arn
    ]
  }

  statement {
    sid    = "CloudWatchLogs"
    effect = "Allow"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ]
    resources = ["${aws_cloudwatch_log_group.aggregator.arn}:*"]
  }
}

resource "aws_iam_role_policy" "aggregator" {
  name   = "aggregator-policy"
  role   = aws_iam_role.aggregator.id
  policy = data.aws_iam_policy_document.aggregator.json
}

# ------------------------------------------------------------------------------
# CloudWatch log groups
# ------------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "ingestion" {
  name              = "/aws/lambda/${local.name_prefix}-ingestion"
  retention_in_days = var.log_retention_days
}

resource "aws_cloudwatch_log_group" "aggregator" {
  name              = "/aws/lambda/${local.name_prefix}-aggregator"
  retention_in_days = var.log_retention_days
}

# ------------------------------------------------------------------------------
# Lambda: Ingestion (publishes to SNS). Created only when zip path is set.
# ------------------------------------------------------------------------------

resource "aws_lambda_function" "ingestion" {
  count = length(var.ingestion_lambda_zip_path) > 0 ? 1 : 0

  function_name = "${local.name_prefix}-ingestion"
  role          = aws_iam_role.ingestion_lambda.arn
  handler       = "bootstrap"
  runtime       = "go1.x"
  filename      = var.ingestion_lambda_zip_path
  memory_size   = var.lambda_memory_mb
  timeout       = var.lambda_timeout_seconds

  environment {
    variables = {
      SNS_TOPIC_ARN = aws_sns_topic.voting_events.arn
    }
  }
}

# ------------------------------------------------------------------------------
# Lambda: Aggregator (consumes SQS, updates DynamoDB). Created only when zip path is set.
# ------------------------------------------------------------------------------

resource "aws_lambda_function" "aggregator" {
  count = length(var.aggregator_lambda_zip_path) > 0 ? 1 : 0

  function_name = "${local.name_prefix}-aggregator"
  role          = aws_iam_role.aggregator.arn
  handler       = "bootstrap"
  runtime       = "go1.x"
  filename      = var.aggregator_lambda_zip_path
  memory_size   = var.lambda_memory_mb
  timeout       = var.lambda_timeout_seconds

  environment {
    variables = {
      SQS_QUEUE_URL                 = aws_sqs_queue.aggregator.url
      DYNAMODB_PROPOSALS_TABLE      = aws_dynamodb_table.proposals.name
      DYNAMODB_VOTER_ACTIVITY_TABLE = aws_dynamodb_table.voter_activity.name
    }
  }
}

# ------------------------------------------------------------------------------
# Event source mapping: SQS (aggregator queue) triggers Aggregator Lambda
# ------------------------------------------------------------------------------

resource "aws_lambda_event_source_mapping" "aggregator_sqs" {
  count = length(var.aggregator_lambda_zip_path) > 0 ? 1 : 0

  event_source_arn = aws_sqs_queue.aggregator.arn
  function_name    = aws_lambda_function.aggregator[0].function_name
  batch_size       = var.lambda_sqs_batch_size
}
