package service_test

import (
	"context"
	"errors"
	"testing"

	"github.com/chain-to-cloud/aggregator/internal/app/domain"
	"github.com/chain-to-cloud/aggregator/internal/app/repository/memory"
	"github.com/chain-to-cloud/aggregator/internal/app/service"
)

func validVoteRevealed() domain.VoteRevealed {
	return domain.VoteRevealed{
		Envelope: domain.Envelope{
			EventID:   "vote-err-1",
			EventType: domain.EventTypeVoteRevealed,
			Timestamp: 100,
			Source:    "voting-contract",
			Version:   1,
		},
		ProposalID:  "p1",
		OptionID:    "yes",
		VoterPubkey: "voter1",
	}
}

func TestProjectionService_ProcessVoteRevealed_IsProcessedError(t *testing.T) {
	processed := newFakeProcessed()
	processed.checkErr = errRepositoryBoom
	svc := service.NewProjectionService(processed, &fakeProposals{}, &fakeVoters{}, testLogger())

	raw, _ := jsonMarshalReveal(validVoteRevealed())
	err := svc.ProcessPayload(context.Background(), raw)
	if !errors.Is(err, errRepositoryBoom) {
		t.Fatalf("got %v, want repository boom", err)
	}
	if processed.isMarked("vote-err-1") {
		t.Fatal("event must not be marked when IsProcessed fails")
	}
}

func TestProjectionService_ProcessVoteRevealed_MarkProcessedError(t *testing.T) {
	store := memory.NewStore()
	processed := newFakeProcessed()
	processed.markErr = errRepositoryBoom
	svc := service.NewProjectionService(processed, store, store, testLogger())

	raw, _ := jsonMarshalReveal(validVoteRevealed())
	err := svc.ProcessPayload(context.Background(), raw)
	if !errors.Is(err, errRepositoryBoom) {
		t.Fatalf("got %v, want repository boom", err)
	}
	if store.ProposalVoteCount("p1", "yes") != 0 {
		t.Fatal("proposal projection must be rolled back when mark fails")
	}
	if store.VoterHasRevealed("voter1", "p1") {
		t.Fatal("voter projection must be rolled back when mark fails")
	}
	if processed.isMarked("vote-err-1") {
		t.Fatal("event must not stay marked when TryMarkProcessed fails")
	}
}

func TestProjectionService_ProcessVoteRevealed_ProposalErrorDoesNotMarkProcessed(t *testing.T) {
	processed := newFakeProcessed()
	proposals := &fakeProposals{applyRevealErr: errRepositoryBoom}
	svc := service.NewProjectionService(processed, proposals, &fakeVoters{}, testLogger())

	raw, _ := jsonMarshalReveal(validVoteRevealed())
	if err := svc.ProcessPayload(context.Background(), raw); err == nil {
		t.Fatal("expected error")
	}
	if processed.isMarked("vote-err-1") {
		t.Fatal("failed apply must not mark event as processed")
	}
}

func TestProjectionService_ProcessVoteRevealed_VoterErrorRollsBackProposalAndDoesNotMark(t *testing.T) {
	store := memory.NewStore()
	processed := newFakeProcessed()
	voters := &voterRevealOnceFails{inner: store, fail: errRepositoryBoom}
	svc := service.NewProjectionService(processed, store, voters, testLogger())

	raw, _ := jsonMarshalReveal(validVoteRevealed())
	if err := svc.ProcessPayload(context.Background(), raw); err == nil {
		t.Fatal("expected error")
	}
	if processed.isMarked("vote-err-1") {
		t.Fatal("failed apply must not mark event as processed")
	}
	if store.ProposalVoteCount("p1", "yes") != 0 {
		t.Fatal("proposal vote must be rolled back when voter store fails")
	}
	if store.VoterHasRevealed("voter1", "p1") {
		t.Fatal("voter activity must not be recorded when voter store fails")
	}
}

func TestProjectionService_ProcessVoteRevealed_RetryAfterVoterErrorIsIdempotent(t *testing.T) {
	store := memory.NewStore()
	voters := &voterRevealOnceFails{inner: store, fail: errRepositoryBoom}
	svc := service.NewProjectionService(store, store, voters, testLogger())

	vote := validVoteRevealed()
	vote.EventID = "retry-vote-1"
	raw, _ := jsonMarshalReveal(vote)

	if err := svc.ProcessPayload(context.Background(), raw); err == nil {
		t.Fatal("expected first attempt to fail")
	}
	if store.ProposalVoteCount("p1", "yes") != 0 {
		t.Fatal("proposal vote must be rolled back when voter store fails")
	}

	if err := svc.ProcessPayload(context.Background(), raw); err != nil {
		t.Fatalf("retry: %v", err)
	}
	if store.ProposalVoteCount("p1", "yes") != 1 {
		t.Fatal("retry must not double-count proposal votes")
	}
	if !store.VoterHasRevealed("voter1", "p1") {
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

func TestProjectionService_ProcessPayload_InvalidVoteRevealed(t *testing.T) {
	store := memory.NewStore()
	svc := service.NewProjectionService(store, store, store, testLogger())

	raw := []byte(`{
		"event_id": "e1",
		"event_type": "VoteRevealed",
		"timestamp": 1,
		"source": "voting-contract",
		"version": 1,
		"option_id": "yes",
		"voter_pubkey": "voter1"
	}`)
	err := svc.ProcessPayload(context.Background(), raw)
	if !errors.Is(err, domain.ErrEventMissingProposalID) {
		t.Fatalf("got %v, want %v", err, domain.ErrEventMissingProposalID)
	}
}

func jsonMarshalReveal(v domain.VoteRevealed) ([]byte, error) {
	return []byte(`{
		"event_id": "` + v.EventID + `",
		"event_type": "VoteRevealed",
		"timestamp": 100,
		"source": "voting-contract",
		"version": 1,
		"proposal_id": "` + v.ProposalID + `",
		"option_id": "` + v.OptionID + `",
		"voter_pubkey": "` + v.VoterPubkey + `"
	}`), nil
}
