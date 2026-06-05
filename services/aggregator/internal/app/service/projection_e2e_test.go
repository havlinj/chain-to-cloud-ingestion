package service_test

import (
	"context"
	"testing"

	"github.com/chain-to-cloud/aggregator/internal/app/repository/memory"
	"github.com/chain-to-cloud/aggregator/internal/app/service"
)

const (
	pipelineProposalID  = "e2e-pipeline-001"
	pipelineVoterPubkey = "11111111111111111111111111111112"
	pipelineOptionID    = "yes"
)

func pipelineProposalCreatedPayload() []byte {
	return []byte(`{
		"event_id": "tx-pc-001:ProposalCreated:0",
		"event_type": "ProposalCreated",
		"timestamp": 1700000000,
		"source": "voting-contract",
		"version": 1,
		"proposal_id": "e2e-pipeline-001",
		"title": "Pipeline E2E",
		"options": ["yes", "no"],
		"commit_ends_at": 1700040000,
		"reveal_ends_at": 1700086400,
		"phase": "commit",
		"slot": 100200,
		"tx_signature": "tx-pc-001"
	}`)
}

func pipelineVoteCommittedPayload() []byte {
	return []byte(`{
		"event_id": "tx-vc-001:VoteCommitted:0",
		"event_type": "VoteCommitted",
		"timestamp": 1700041000,
		"source": "voting-contract",
		"version": 1,
		"proposal_id": "e2e-pipeline-001",
		"voter_pubkey": "11111111111111111111111111111112",
		"commitment": "2fHb8QiezB2CSfXhwtZ9WaJ81HCtGJhP5eXEbQCwcbuz",
		"slot": 100250,
		"tx_signature": "tx-vc-001"
	}`)
}

func pipelineVoteRevealedPayload() []byte {
	return []byte(`{
		"event_id": "tx-vr-001:VoteRevealed:0",
		"event_type": "VoteRevealed",
		"timestamp": 1700086500,
		"source": "voting-contract",
		"version": 1,
		"proposal_id": "e2e-pipeline-001",
		"option_id": "yes",
		"voter_pubkey": "11111111111111111111111111111112",
		"slot": 100300,
		"tx_signature": "tx-vr-001"
	}`)
}

func pipelineProposalFinalizedPayload() []byte {
	return []byte(`{
		"event_id": "tx-pf-001:ProposalFinalized:0",
		"event_type": "ProposalFinalized",
		"timestamp": 1700087000,
		"source": "voting-contract",
		"version": 1,
		"proposal_id": "e2e-pipeline-001",
		"slot": 100310,
		"tx_signature": "tx-pf-001"
	}`)
}

func processPipelineEvent(
	t *testing.T,
	svc *service.ProjectionService,
	ctx context.Context,
	raw []byte,
	eventType string,
) {
	t.Helper()
	if err := svc.ProcessPayload(ctx, raw); err != nil {
		t.Fatalf("ProcessPayload(%s): %v", eventType, err)
	}
}

func TestProjectionService_E2E_CommitRevealFinalizeLifecycle(t *testing.T) {
	store := memory.NewStore()
	svc := service.NewProjectionService(store, store, store, testLogger())
	ctx := context.Background()

	processPipelineEvent(t, svc, ctx, pipelineProposalCreatedPayload(), "ProposalCreated")
	processPipelineEvent(t, svc, ctx, pipelineVoteCommittedPayload(), "VoteCommitted")
	processPipelineEvent(t, svc, ctx, pipelineVoteRevealedPayload(), "VoteRevealed")
	processPipelineEvent(t, svc, ctx, pipelineProposalFinalizedPayload(), "ProposalFinalized")

	if !store.VoterHasCommitted(pipelineVoterPubkey, pipelineProposalID) {
		t.Fatalf(
			"expected has_committed=true for %s on %s",
			pipelineVoterPubkey,
			pipelineProposalID,
		)
	}
	if !store.VoterHasRevealed(pipelineVoterPubkey, pipelineProposalID) {
		t.Fatalf(
			"expected has_revealed=true for %s on %s",
			pipelineVoterPubkey,
			pipelineProposalID,
		)
	}
	if got := store.ProposalVoteCount(pipelineProposalID, pipelineOptionID); got != 1 {
		t.Fatalf(
			"expected option_counts[%s]=1 after VoteRevealed, got %d",
			pipelineOptionID,
			got,
		)
	}
	if !store.ProposalResultsVisible(pipelineProposalID) {
		t.Fatal("expected results_visible=true after ProposalFinalized")
	}
}

func TestProjectionService_E2E_ResultsNotVisibleBeforeFinalize(t *testing.T) {
	store := memory.NewStore()
	svc := service.NewProjectionService(store, store, store, testLogger())
	ctx := context.Background()

	processPipelineEvent(t, svc, ctx, pipelineProposalCreatedPayload(), "ProposalCreated")
	processPipelineEvent(t, svc, ctx, pipelineVoteCommittedPayload(), "VoteCommitted")
	processPipelineEvent(t, svc, ctx, pipelineVoteRevealedPayload(), "VoteRevealed")

	if store.ProposalResultsVisible(pipelineProposalID) {
		t.Fatal("expected results_visible=false before ProposalFinalized")
	}
	if got := store.ProposalVoteCount(pipelineProposalID, pipelineOptionID); got != 1 {
		t.Fatalf(
			"expected option_counts[%s]=1 after VoteRevealed (tally before finalize), got %d",
			pipelineOptionID,
			got,
		)
	}
}

func TestProjectionService_E2E_LifecycleDuplicateDeliveryIsIdempotent(t *testing.T) {
	store := memory.NewStore()
	svc := service.NewProjectionService(store, store, store, testLogger())
	ctx := context.Background()

	for pass := 1; pass <= 2; pass++ {
		for _, step := range []struct {
			raw       []byte
			eventType string
		}{
			{pipelineProposalCreatedPayload(), "ProposalCreated"},
			{pipelineVoteCommittedPayload(), "VoteCommitted"},
			{pipelineVoteRevealedPayload(), "VoteRevealed"},
			{pipelineProposalFinalizedPayload(), "ProposalFinalized"},
		} {
			processPipelineEvent(t, svc, ctx, step.raw, step.eventType)
		}
	}

	if got := store.ProposalVoteCount(pipelineProposalID, pipelineOptionID); got != 1 {
		t.Fatalf(
			"duplicate delivery must keep option_counts[%s]=1, got %d",
			pipelineOptionID,
			got,
		)
	}
}
