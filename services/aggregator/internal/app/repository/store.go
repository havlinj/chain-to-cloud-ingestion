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
	ApplyVoteCast(ctx context.Context, vote domain.VoteCast) error
	UndoVoteCast(ctx context.Context, vote domain.VoteCast) error
}

type VoterActivityStore interface {
	RecordVoteCast(ctx context.Context, vote domain.VoteCast) error
	UndoRecordVoteCast(ctx context.Context, vote domain.VoteCast) error
}

type Store interface {
	ProcessedEventsStore
	ProposalsStore
	VoterActivityStore
}
