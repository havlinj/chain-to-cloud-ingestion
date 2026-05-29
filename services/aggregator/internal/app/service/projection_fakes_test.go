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
	applyRevealErr error
	undoRevealErr  error
}

func (f *fakeProposals) ApplyProposalCreated(context.Context, domain.ProposalCreated) error {
	return nil
}

func (f *fakeProposals) ApplyVoteRevealed(context.Context, domain.VoteRevealed) error {
	return f.applyRevealErr
}

func (f *fakeProposals) UndoVoteRevealed(context.Context, domain.VoteRevealed) error {
	return f.undoRevealErr
}

func (f *fakeProposals) ApplyProposalFinalized(context.Context, domain.ProposalFinalized) error {
	return nil
}

func (f *fakeProposals) ApplyProposalClosed(context.Context, domain.ProposalClosed) error {
	return nil
}

type fakeVoters struct {
	err error
}

func (f *fakeVoters) RecordVoteCommitted(context.Context, domain.VoteCommitted) error {
	return nil
}

func (f *fakeVoters) UndoRecordVoteCommitted(context.Context, domain.VoteCommitted) error {
	return nil
}

func (f *fakeVoters) RecordVoteRevealed(context.Context, domain.VoteRevealed) error {
	return f.err
}

func (f *fakeVoters) UndoRecordVoteRevealed(context.Context, domain.VoteRevealed) error {
	return nil
}

type voterRevealOnceFails struct {
	inner repository.VoterActivityStore
	fail  error
	used  bool
}

func (v *voterRevealOnceFails) RecordVoteCommitted(ctx context.Context, e domain.VoteCommitted) error {
	return v.inner.RecordVoteCommitted(ctx, e)
}

func (v *voterRevealOnceFails) UndoRecordVoteCommitted(ctx context.Context, e domain.VoteCommitted) error {
	return v.inner.UndoRecordVoteCommitted(ctx, e)
}

func (v *voterRevealOnceFails) RecordVoteRevealed(ctx context.Context, e domain.VoteRevealed) error {
	if !v.used {
		v.used = true
		return v.fail
	}
	return v.inner.RecordVoteRevealed(ctx, e)
}

func (v *voterRevealOnceFails) UndoRecordVoteRevealed(ctx context.Context, e domain.VoteRevealed) error {
	return v.inner.UndoRecordVoteRevealed(ctx, e)
}
