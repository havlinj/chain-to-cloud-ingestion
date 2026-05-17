package handlers

import (
	"context"
	"log/slog"

	"github.com/aws/aws-lambda-go/events"

	"github.com/chain-to-cloud/aggregator/internal/app/domain"
	"github.com/chain-to-cloud/aggregator/internal/app/service"
)

type SQSHandler struct {
	service *service.ProjectionService
	logger  *slog.Logger
}

func NewSQSHandler(svc *service.ProjectionService, logger *slog.Logger) *SQSHandler {
	if logger == nil {
		logger = slog.Default()
	}
	return &SQSHandler{service: svc, logger: logger}
}

func (h *SQSHandler) Handle(ctx context.Context, sqsEvent events.SQSEvent) (events.SQSEventResponse, error) {
	response := events.SQSEventResponse{}

	for _, record := range sqsEvent.Records {
		if err := h.handleRecord(ctx, record); err != nil {
			h.logger.Error(
				"sqs record failed",
				"service", "aggregator",
				"message_id", record.MessageId,
				"error", err,
			)
			response.BatchItemFailures = append(response.BatchItemFailures, events.SQSBatchItemFailure{
				ItemIdentifier: record.MessageId,
			})
		}
	}

	return response, nil
}

func (h *SQSHandler) handleRecord(ctx context.Context, record events.SQSMessage) error {
	payload, err := domain.UnwrapEventPayload(record.Body)
	if err != nil {
		return err
	}
	return h.service.ProcessPayload(ctx, payload)
}
