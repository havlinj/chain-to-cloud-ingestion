package repository

import (
	"context"

	"github.com/chain-to-cloud/aggregator/internal/app/domain"
)

type ProcessedEventsStore interface {
	IsProcessed(ctx context.Context, eventID string) (bool, error)
	TryMarkProcessed(ctx context.Context, eventID string) (alreadyProcessed bool, err error)
	RemoveProcessed(ctx context.Context, eventID string) error
}

type ProposalsStore interface {
	ApplyProposalCreated(ctx context.Context, event domain.ProposalCreated) error
	ApplyVoteRevealed(ctx context.Context, event domain.VoteRevealed) error
	UndoVoteRevealed(ctx context.Context, event domain.VoteRevealed) error
	ApplyProposalFinalized(ctx context.Context, event domain.ProposalFinalized) error
	ApplyProposalClosed(ctx context.Context, event domain.ProposalClosed) error
}

type VoterActivityStore interface {
	RecordVoteCommitted(ctx context.Context, event domain.VoteCommitted) error
	UndoRecordVoteCommitted(ctx context.Context, event domain.VoteCommitted) error
	RecordVoteRevealed(ctx context.Context, event domain.VoteRevealed) error
	UndoRecordVoteRevealed(ctx context.Context, event domain.VoteRevealed) error
}

type Store interface {
	ProcessedEventsStore
	ProposalsStore
	VoterActivityStore
}
