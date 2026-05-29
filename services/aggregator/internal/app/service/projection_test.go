package service_test

import (
	"context"
	"encoding/json"
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

func TestProjectionService_ProcessPayload_AppliesVoteRevealed(t *testing.T) {
	store := memory.NewStore()
	svc := service.NewProjectionService(store, store, store, testLogger())

	raw := []byte(`{
		"event_id": "vr-1",
		"event_type": "VoteRevealed",
		"timestamp": 100,
		"source": "voting-contract",
		"version": 1,
		"proposal_id": "p1",
		"option_id": "yes",
		"voter_pubkey": "voter1"
	}`)
	if err := svc.ProcessPayload(context.Background(), raw); err != nil {
		t.Fatalf("process: %v", err)
	}
	if store.ProposalVoteCount("p1", "yes") != 1 {
		t.Fatal("expected tally from VoteRevealed")
	}
	if !store.VoterHasRevealed("voter1", "p1") {
		t.Fatal("expected voter has_revealed")
	}
}

func TestProjectionService_ProcessPayload_VoteRevealedDuplicateDoesNotDoubleCount(t *testing.T) {
	store := memory.NewStore()
	svc := service.NewProjectionService(store, store, store, testLogger())

	raw := []byte(`{
		"event_id": "dup-vr",
		"event_type": "VoteRevealed",
		"timestamp": 100,
		"source": "voting-contract",
		"version": 1,
		"proposal_id": "p1",
		"option_id": "no",
		"voter_pubkey": "voter1"
	}`)
	if err := svc.ProcessPayload(context.Background(), raw); err != nil {
		t.Fatalf("first: %v", err)
	}
	if err := svc.ProcessPayload(context.Background(), raw); err != nil {
		t.Fatalf("duplicate: %v", err)
	}
	if store.ProposalVoteCount("p1", "no") != 1 {
		t.Fatal("duplicate must not increment option count")
	}
}

func TestProjectionService_ProcessPayload_AppliesProposalCreated(t *testing.T) {
	store := memory.NewStore()
	svc := service.NewProjectionService(store, store, store, testLogger())

	raw := []byte(`{
		"event_id": "pc-2",
		"event_type": "ProposalCreated",
		"timestamp": 1,
		"source": "voting-contract",
		"version": 1,
		"proposal_id": "p2",
		"title": "T",
		"options": ["a","b"],
		"commit_ends_at": 10,
		"reveal_ends_at": 20,
		"phase": "commit"
	}`)
	if err := svc.ProcessPayload(context.Background(), raw); err != nil {
		t.Fatalf("process: %v", err)
	}
	if store.ProposalVoteCount("p2", "a") != 0 {
		t.Fatal("new proposal should start with zero counts")
	}
}

func TestProjectionService_ProcessPayload_ProposalFinalizedSetsResultsVisible(t *testing.T) {
	store := memory.NewStore()
	svc := service.NewProjectionService(store, store, store, testLogger())

	created := domain.ProposalCreated{
		Envelope: domain.Envelope{
			EventID:   "pc-pf",
			EventType: domain.EventTypeProposalCreated,
			Timestamp: 1,
			Source:    "voting-contract",
			Version:   1,
		},
		ProposalID:   "pf-1",
		Title:        "T",
		Options:      []string{"a", "b"},
		CommitEndsAt: 10,
		RevealEndsAt: 20,
		Phase:        "commit",
	}
	createdRaw, err := json.Marshal(created)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if err := svc.ProcessPayload(context.Background(), createdRaw); err != nil {
		t.Fatalf("create: %v", err)
	}

	raw := []byte(`{
		"event_id": "fin-1",
		"event_type": "ProposalFinalized",
		"timestamp": 200,
		"source": "voting-contract",
		"version": 1,
		"proposal_id": "pf-1"
	}`)
	if err := svc.ProcessPayload(context.Background(), raw); err != nil {
		t.Fatalf("finalize: %v", err)
	}
	if !store.ProposalResultsVisible("pf-1") {
		t.Fatal("ProposalFinalized must set results_visible")
	}
}

func TestProjectionService_ProcessPayload_VoteRevealedWithUnknownFields(t *testing.T) {
	store := memory.NewStore()
	svc := service.NewProjectionService(store, store, store, testLogger())

	raw := []byte(`{
		"event_id": "extra-vr",
		"event_type": "VoteRevealed",
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
		t.Fatal("VoteRevealed with unknown fields should apply")
	}
}
