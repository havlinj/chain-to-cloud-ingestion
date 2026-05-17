package service

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/chain-to-cloud/aggregator/internal/app/domain"
	"github.com/chain-to-cloud/aggregator/internal/app/repository"
)

type ProjectionService struct {
	processed repository.ProcessedEventsStore
	proposals repository.ProposalsStore
	voters    repository.VoterActivityStore
	logger    *slog.Logger
}

func NewProjectionService(
	processed repository.ProcessedEventsStore,
	proposals repository.ProposalsStore,
	voters repository.VoterActivityStore,
	logger *slog.Logger,
) *ProjectionService {
	if logger == nil {
		logger = slog.Default()
	}
	return &ProjectionService{
		processed: processed,
		proposals: proposals,
		voters:    voters,
		logger:    logger,
	}
}

func (s *ProjectionService) ProcessPayload(ctx context.Context, raw []byte) error {
	eventType, err := domain.EventTypeFromPayload(raw)
	if err != nil {
		return err
	}
	if eventType != domain.EventTypeVoteCast {
		s.logger.Info(
			"skip unsupported event type for iteration 1",
			"service", "aggregator",
			"event_type", eventType,
		)
		return nil
	}

	vote, err := domain.ParseVoteCast(raw)
	if err != nil {
		return err
	}
	return s.ProcessVoteCast(ctx, vote)
}

func (s *ProjectionService) ProcessVoteCast(ctx context.Context, vote domain.VoteCast) error {
	already, err := s.processed.IsProcessed(ctx, vote.EventID)
	if err != nil {
		return fmt.Errorf("check processed VoteCast: %w", err)
	}
	if already {
		s.logger.Info(
			"duplicate event skipped",
			"service", "aggregator",
			"event_id", vote.EventID,
			"event_type", vote.EventType,
			"proposal_id", vote.ProposalID,
		)
		return nil
	}

	if err := s.applyVoteCast(ctx, vote); err != nil {
		return err
	}

	already, err = s.processed.TryMarkProcessed(ctx, vote.EventID)
	if err != nil {
		s.rollbackVoteCast(ctx, vote)
		return fmt.Errorf("mark processed VoteCast: %w", err)
	}
	if already {
		s.rollbackVoteCast(ctx, vote)
		s.logger.Warn(
			"processed marker already exists after apply",
			"service", "aggregator",
			"event_id", vote.EventID,
		)
		return nil
	}

	s.logger.Info(
		"VoteCast applied",
		"service", "aggregator",
		"event_id", vote.EventID,
		"event_type", vote.EventType,
		"proposal_id", vote.ProposalID,
	)
	return nil
}

func (s *ProjectionService) applyVoteCast(ctx context.Context, vote domain.VoteCast) error {
	if err := s.proposals.ApplyVoteCast(ctx, vote); err != nil {
		return fmt.Errorf("update proposal projection: %w", err)
	}
	if err := s.voters.RecordVoteCast(ctx, vote); err != nil {
		if undoErr := s.proposals.UndoVoteCast(ctx, vote); undoErr != nil {
			return fmt.Errorf("update voter activity: %w (undo proposal: %v)", err, undoErr)
		}
		return fmt.Errorf("update voter activity: %w", err)
	}
	return nil
}

func (s *ProjectionService) rollbackVoteCast(ctx context.Context, vote domain.VoteCast) {
	if err := s.voters.UndoRecordVoteCast(ctx, vote); err != nil {
		s.logger.Error(
			"rollback voter activity failed",
			"service", "aggregator",
			"event_id", vote.EventID,
			"error", err,
		)
	}
	if err := s.proposals.UndoVoteCast(ctx, vote); err != nil {
		s.logger.Error(
			"rollback proposal projection failed",
			"service", "aggregator",
			"event_id", vote.EventID,
			"error", err,
		)
	}
}
