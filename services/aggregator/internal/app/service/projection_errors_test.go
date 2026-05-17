package service_test

import (
	"context"
	"errors"
	"testing"

	"github.com/chain-to-cloud/aggregator/internal/app/domain"
	"github.com/chain-to-cloud/aggregator/internal/app/repository/memory"
	"github.com/chain-to-cloud/aggregator/internal/app/service"
)

func TestProjectionService_ProcessVoteCast_IsProcessedError(t *testing.T) {
	processed := newFakeProcessed()
	processed.checkErr = errRepositoryBoom
	svc := service.NewProjectionService(processed, &fakeProposals{}, &fakeVoters{}, testLogger())

	err := svc.ProcessVoteCast(context.Background(), validVote())
	if !errors.Is(err, errRepositoryBoom) {
		t.Fatalf("got %v, want repository boom", err)
	}
	if processed.isMarked("vote-err-1") {
		t.Fatal("event must not be marked when IsProcessed fails")
	}
}

func TestProjectionService_ProcessVoteCast_MarkProcessedError(t *testing.T) {
	store := memory.NewStore()
	processed := newFakeProcessed()
	processed.markErr = errRepositoryBoom
	svc := service.NewProjectionService(processed, store, store, testLogger())

	err := svc.ProcessVoteCast(context.Background(), validVote())
	if !errors.Is(err, errRepositoryBoom) {
		t.Fatalf("got %v, want repository boom", err)
	}
	if store.ProposalVoteCount("p1", "yes") != 0 {
		t.Fatal("proposal projection must be rolled back when mark fails")
	}
	if store.VoterVotesCast("voter1") != 0 {
		t.Fatal("voter projection must be rolled back when mark fails")
	}
	if processed.isMarked("vote-err-1") {
		t.Fatal("event must not stay marked when TryMarkProcessed fails")
	}
}

func TestProjectionService_ProcessVoteCast_ProposalErrorDoesNotMarkProcessed(t *testing.T) {
	processed := newFakeProcessed()
	proposals := &fakeProposals{applyErr: errRepositoryBoom}
	svc := service.NewProjectionService(processed, proposals, &fakeVoters{}, testLogger())

	if err := svc.ProcessVoteCast(context.Background(), validVote()); err == nil {
		t.Fatal("expected error")
	}
	if processed.isMarked("vote-err-1") {
		t.Fatal("failed apply must not mark event as processed")
	}
}

func TestProjectionService_ProcessVoteCast_VoterErrorRollsBackProposalAndDoesNotMark(t *testing.T) {
	store := memory.NewStore()
	processed := newFakeProcessed()
	voters := &voterOnceFails{inner: store, fail: errRepositoryBoom}
	svc := service.NewProjectionService(processed, store, voters, testLogger())

	if err := svc.ProcessVoteCast(context.Background(), validVote()); err == nil {
		t.Fatal("expected error")
	}
	if processed.isMarked("vote-err-1") {
		t.Fatal("failed apply must not mark event as processed")
	}
	if store.ProposalVoteCount("p1", "yes") != 0 {
		t.Fatal("proposal vote must be rolled back when voter store fails")
	}
	if store.VoterVotesCast("voter1") != 0 {
		t.Fatal("voter activity must not be recorded when voter store fails")
	}
}

func TestProjectionService_ProcessVoteCast_RetryAfterVoterErrorIsIdempotent(t *testing.T) {
	store := memory.NewStore()
	voters := &voterOnceFails{inner: store, fail: errRepositoryBoom}
	svc := service.NewProjectionService(store, store, voters, testLogger())
	vote := validVote()
	vote.EventID = "retry-vote-1"

	if err := svc.ProcessVoteCast(context.Background(), vote); err == nil {
		t.Fatal("expected first attempt to fail")
	}
	if store.ProposalVoteCount("p1", "yes") != 0 {
		t.Fatal("proposal vote must be rolled back when voter store fails")
	}
	if store.VoterVotesCast("voter1") != 0 {
		t.Fatal("voter activity must not be recorded when voter store fails")
	}

	if err := svc.ProcessVoteCast(context.Background(), vote); err != nil {
		t.Fatalf("retry: %v", err)
	}
	if store.ProposalVoteCount("p1", "yes") != 1 {
		t.Fatal("retry must not double-count proposal votes")
	}
	if store.VoterVotesCast("voter1") != 1 {
		t.Fatal("retry should record voter activity once")
	}
}

func TestProjectionService_ProcessPayload_MissingEventType(t *testing.T) {
	store := memory.NewStore()
	svc := service.NewProjectionService(store, store, store, testLogger())

	err := svc.ProcessPayload(context.Background(), []byte(`{"event_id":"e1"}`))
	if !errors.Is(err, domain.ErrEventTypeMissing) {
		t.Fatalf("got %v, want %v", err, domain.ErrEventTypeMissing)
	}
}

func TestProjectionService_ProcessPayload_InvalidVoteCast(t *testing.T) {
	store := memory.NewStore()
	svc := service.NewProjectionService(store, store, store, testLogger())

	raw := []byte(`{
		"event_id": "e1",
		"event_type": "VoteCast",
		"timestamp": 1,
		"source": "voting-contract",
		"version": 1,
		"option_id": "yes",
		"voter_pubkey": "voter1"
	}`)
	err := svc.ProcessPayload(context.Background(), raw)
	if !errors.Is(err, domain.ErrVoteCastMissingProposalID) {
		t.Fatalf("got %v, want %v", err, domain.ErrVoteCastMissingProposalID)
	}
}

func TestProjectionService_ProcessPayload_SkipsProposalClosed(t *testing.T) {
	store := memory.NewStore()
	svc := service.NewProjectionService(store, store, store, testLogger())

	raw := []byte(`{
		"event_id": "e3",
		"event_type": "ProposalClosed",
		"timestamp": 1,
		"source": "voting-contract",
		"version": 1,
		"proposal_id": "p3"
	}`)
	if err := svc.ProcessPayload(context.Background(), raw); err != nil {
		t.Fatalf("process: %v", err)
	}
	if store.ProposalVoteCount("p3", "yes") != 0 {
		t.Fatal("ProposalClosed should not update projections in iteration 1")
	}
}
