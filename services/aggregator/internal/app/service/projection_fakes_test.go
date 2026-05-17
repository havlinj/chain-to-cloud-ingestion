package service_test

import (
	"context"
	"errors"

	"github.com/chain-to-cloud/aggregator/internal/app/domain"
	"github.com/chain-to-cloud/aggregator/internal/app/repository"
)

var errRepositoryBoom = errors.New("repository boom")

type fakeProcessed struct {
	checkErr error
	markErr  error
	already  bool
	marked   map[string]struct{}
}

func newFakeProcessed() *fakeProcessed {
	return &fakeProcessed{marked: make(map[string]struct{})}
}

func (f *fakeProcessed) IsProcessed(_ context.Context, eventID string) (bool, error) {
	if f.checkErr != nil {
		return false, f.checkErr
	}
	if f.already {
		return true, nil
	}
	_, exists := f.marked[eventID]
	return exists, nil
}

func (f *fakeProcessed) TryMarkProcessed(_ context.Context, eventID string) (bool, error) {
	if f.markErr != nil {
		return false, f.markErr
	}
	if _, exists := f.marked[eventID]; exists {
		return true, nil
	}
	f.marked[eventID] = struct{}{}
	return false, nil
}

func (f *fakeProcessed) RemoveProcessed(_ context.Context, eventID string) error {
	delete(f.marked, eventID)
	return nil
}

func (f *fakeProcessed) isMarked(eventID string) bool {
	_, exists := f.marked[eventID]
	return exists
}

type fakeProposals struct {
	applyErr error
	undoErr  error
}

func (f *fakeProposals) ApplyVoteCast(_ context.Context, _ domain.VoteCast) error {
	return f.applyErr
}

func (f *fakeProposals) UndoVoteCast(_ context.Context, _ domain.VoteCast) error {
	return f.undoErr
}

type fakeVoters struct {
	err error
}

func (f *fakeVoters) RecordVoteCast(_ context.Context, _ domain.VoteCast) error {
	return f.err
}

func (f *fakeVoters) UndoRecordVoteCast(_ context.Context, _ domain.VoteCast) error {
	return nil
}

// voterOnceFails returns fail on the first RecordVoteCast call, then delegates to inner.
type voterOnceFails struct {
	inner repository.VoterActivityStore
	fail  error
	used  bool
}

func (v *voterOnceFails) RecordVoteCast(ctx context.Context, vote domain.VoteCast) error {
	if !v.used {
		v.used = true
		return v.fail
	}
	return v.inner.RecordVoteCast(ctx, vote)
}

func (v *voterOnceFails) UndoRecordVoteCast(ctx context.Context, vote domain.VoteCast) error {
	return v.inner.UndoRecordVoteCast(ctx, vote)
}
