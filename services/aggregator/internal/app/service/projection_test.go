package service_test

import (
	"context"
	"log/slog"
	"os"
	"testing"

	"github.com/chain-to-cloud/aggregator/internal/app/domain"
	"github.com/chain-to-cloud/aggregator/internal/app/repository/memory"
	"github.com/chain-to-cloud/aggregator/internal/app/service"
)

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(os.Stderr, nil))
}

func validVote() domain.VoteCast {
	return domain.VoteCast{
		Envelope: domain.Envelope{
			EventID:   "vote-err-1",
			EventType: domain.EventTypeVoteCast,
			Timestamp: 100,
			Source:    "voting-contract",
			Version:   1,
		},
		ProposalID:  "p1",
		OptionID:    "yes",
		VoterPubkey: "voter1",
	}
}

func TestProjectionService_ApplyVoteCast_IncrementsOptionCount(t *testing.T) {
	store := memory.NewStore()
	svc := service.NewProjectionService(store, store, store, testLogger())

	vote := domain.VoteCast{
		Envelope: domain.Envelope{
			EventID:   "e1",
			EventType: domain.EventTypeVoteCast,
			Timestamp: 100,
			Source:    "voting-contract",
			Version:   1,
		},
		ProposalID:  "p1",
		OptionID:    "yes",
		VoterPubkey: "voter1",
		Slot:        1,
		TxSignature: "sig",
	}

	if err := svc.ProcessVoteCast(context.Background(), vote); err != nil {
		t.Fatalf("first apply: %v", err)
	}
	if store.ProposalVoteCount("p1", "yes") != 1 {
		t.Fatalf("expected one vote on option yes")
	}
	if store.VoterVotesCast("voter1") != 1 {
		t.Fatalf("expected one vote for voter")
	}
}

func TestProjectionService_ApplyVoteCast_DuplicateDoesNotDoubleCount(t *testing.T) {
	store := memory.NewStore()
	svc := service.NewProjectionService(store, store, store, testLogger())

	vote := domain.VoteCast{
		Envelope: domain.Envelope{
			EventID:   "dup-1",
			EventType: domain.EventTypeVoteCast,
			Timestamp: 100,
			Source:    "voting-contract",
			Version:   1,
		},
		ProposalID:  "p1",
		OptionID:    "no",
		VoterPubkey: "voter1",
	}

	if err := svc.ProcessVoteCast(context.Background(), vote); err != nil {
		t.Fatalf("first apply: %v", err)
	}
	if err := svc.ProcessVoteCast(context.Background(), vote); err != nil {
		t.Fatalf("duplicate apply: %v", err)
	}
	if store.ProposalVoteCount("p1", "no") != 1 {
		t.Fatalf("duplicate must not increment option count")
	}
}

func TestProjectionService_ProcessPayload_AppliesVoteCastWithUnknownFields(t *testing.T) {
	store := memory.NewStore()
	svc := service.NewProjectionService(store, store, store, testLogger())

	raw := []byte(`{
		"event_id": "extra-1",
		"event_type": "VoteCast",
		"timestamp": 1,
		"source": "voting-contract",
		"version": 1,
		"proposal_id": "p1",
		"option_id": "yes",
		"voter_pubkey": "voter1",
		"unknown_field": true
	}`)
	if err := svc.ProcessPayload(context.Background(), raw); err != nil {
		t.Fatalf("process: %v", err)
	}
	if store.ProposalVoteCount("p1", "yes") != 1 {
		t.Fatal("VoteCast with unknown fields should apply")
	}
}

func TestProjectionService_ProcessPayload_SkipsProposalCreated(t *testing.T) {
	store := memory.NewStore()
	svc := service.NewProjectionService(store, store, store, testLogger())

	raw := []byte(`{
		"event_id": "e2",
		"event_type": "ProposalCreated",
		"timestamp": 1,
		"source": "voting-contract",
		"version": 1,
		"proposal_id": "p2",
		"title": "Test",
		"options": ["a","b"]
	}`)

	if err := svc.ProcessPayload(context.Background(), raw); err != nil {
		t.Fatalf("process: %v", err)
	}
	if store.ProposalVoteCount("p2", "a") != 0 {
		t.Fatal("ProposalCreated should not update projections in iteration 1")
	}
}
