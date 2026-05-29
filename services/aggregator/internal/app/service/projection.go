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

	switch eventType {
	case domain.EventTypeProposalCreated:
		event, err := domain.ParseProposalCreated(raw)
		if err != nil {
			return err
		}
		return s.processProposalCreated(ctx, event)
	case domain.EventTypeVoteCommitted:
		event, err := domain.ParseVoteCommitted(raw)
		if err != nil {
			return err
		}
		return s.processVoteCommitted(ctx, event)
	case domain.EventTypeVoteRevealed:
		event, err := domain.ParseVoteRevealed(raw)
		if err != nil {
			return err
		}
		return s.processVoteRevealed(ctx, event)
	case domain.EventTypeProposalFinalized:
		event, err := domain.ParseProposalFinalized(raw)
		if err != nil {
			return err
		}
		return s.processProposalFinalized(ctx, event)
	case domain.EventTypeProposalClosed:
		event, err := domain.ParseProposalClosed(raw)
		if err != nil {
			return err
		}
		return s.processProposalClosed(ctx, event)
	case domain.EventTypeEligibleVotersRootUpdated,
		domain.EventTypeVoterEligibilityGranted,
		domain.EventTypeVoterEligibilityRevoked:
		s.logger.Info(
			"skip eligibility audit event (not projected in this iteration)",
			"service", "aggregator",
			"event_type", eventType,
		)
		return nil
	default:
		s.logger.Info(
			"skip unsupported event type",
			"service", "aggregator",
			"event_type", eventType,
		)
		return nil
	}
}

func (s *ProjectionService) processProposalCreated(ctx context.Context, event domain.ProposalCreated) error {
	return s.runIdempotent(ctx, event.EventID, event.EventType, event.ProposalID, func() error {
		return s.proposals.ApplyProposalCreated(ctx, event)
	}, nil)
}

func (s *ProjectionService) processVoteCommitted(ctx context.Context, event domain.VoteCommitted) error {
	return s.runIdempotent(ctx, event.EventID, event.EventType, event.ProposalID, func() error {
		return s.voters.RecordVoteCommitted(ctx, event)
	}, func() {
		s.voters.UndoRecordVoteCommitted(ctx, event)
	})
}

func (s *ProjectionService) processVoteRevealed(ctx context.Context, event domain.VoteRevealed) error {
	return s.runIdempotent(ctx, event.EventID, event.EventType, event.ProposalID, func() error {
		if err := s.proposals.ApplyVoteRevealed(ctx, event); err != nil {
			return err
		}
		if err := s.voters.RecordVoteRevealed(ctx, event); err != nil {
			if undoErr := s.proposals.UndoVoteRevealed(ctx, event); undoErr != nil {
				return fmt.Errorf("record VoteRevealed: %w (undo proposal: %v)", err, undoErr)
			}
			return fmt.Errorf("record VoteRevealed: %w", err)
		}
		return nil
	}, func() {
		s.voters.UndoRecordVoteRevealed(ctx, event)
		s.proposals.UndoVoteRevealed(ctx, event)
	})
}

func (s *ProjectionService) processProposalFinalized(ctx context.Context, event domain.ProposalFinalized) error {
	return s.runIdempotent(ctx, event.EventID, event.EventType, event.ProposalID, func() error {
		return s.proposals.ApplyProposalFinalized(ctx, event)
	}, nil)
}

func (s *ProjectionService) processProposalClosed(ctx context.Context, event domain.ProposalClosed) error {
	return s.runIdempotent(ctx, event.EventID, event.EventType, event.ProposalID, func() error {
		return s.proposals.ApplyProposalClosed(ctx, event)
	}, nil)
}

func (s *ProjectionService) runIdempotent(
	ctx context.Context,
	eventID string,
	eventType string,
	proposalID string,
	apply func() error,
	rollback func(),
) error {
	already, err := s.processed.IsProcessed(ctx, eventID)
	if err != nil {
		return fmt.Errorf("check processed %s: %w", eventType, err)
	}
	if already {
		s.logger.Info(
			"duplicate event skipped",
			"service", "aggregator",
			"event_id", eventID,
			"event_type", eventType,
			"proposal_id", proposalID,
		)
		return nil
	}

	if err := apply(); err != nil {
		return err
	}

	already, err = s.processed.TryMarkProcessed(ctx, eventID)
	if err != nil {
		if rollback != nil {
			rollback()
		}
		return fmt.Errorf("mark processed %s: %w", eventType, err)
	}
	if already {
		if rollback != nil {
			rollback()
		}
		s.logger.Warn(
			"processed marker already exists after apply",
			"service", "aggregator",
			"event_id", eventID,
			"event_type", eventType,
		)
		return nil
	}

	s.logger.Info(
		"event applied",
		"service", "aggregator",
		"event_id", eventID,
		"event_type", eventType,
		"proposal_id", proposalID,
	)
	return nil
}
