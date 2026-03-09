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
