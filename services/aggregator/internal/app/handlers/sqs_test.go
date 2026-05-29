package handlers_test

import (
	"context"
	"log/slog"
	"os"
	"testing"

	"github.com/aws/aws-lambda-go/events"

	"github.com/chain-to-cloud/aggregator/internal/app/handlers"
	"github.com/chain-to-cloud/aggregator/internal/app/repository/memory"
	"github.com/chain-to-cloud/aggregator/internal/app/service"
)

func newTestHandler() (*handlers.SQSHandler, *memory.Store) {
	store := memory.NewStore()
	svc := service.NewProjectionService(store, store, store, slog.New(slog.NewTextHandler(os.Stderr, nil)))
	return handlers.NewSQSHandler(svc, slog.Default()), store
}

func TestSQSHandler_Handle_VoteRevealedThroughSNSEnvelope(t *testing.T) {
	handler, store := newTestHandler()

	body := `{"Type":"Notification","Message":"{\"event_id\":\"sqs-1\",\"event_type\":\"VoteRevealed\",\"timestamp\":1,\"source\":\"voting-contract\",\"version\":1,\"proposal_id\":\"p1\",\"option_id\":\"a\",\"voter_pubkey\":\"v1\",\"slot\":1,\"tx_signature\":\"sig\"}"}`
	event := events.SQSEvent{
		Records: []events.SQSMessage{
			{MessageId: "msg-1", Body: body},
		},
	}

	resp, err := handler.Handle(context.Background(), event)
	if err != nil {
		t.Fatalf("handle: %v", err)
	}
	if len(resp.BatchItemFailures) != 0 {
		t.Fatalf("batch failures: %+v", resp.BatchItemFailures)
	}
	if store.ProposalVoteCount("p1", "a") != 1 {
		t.Fatal("expected vote to be applied")
	}
}

func TestSQSHandler_Handle_InvalidBodyReportsBatchFailure(t *testing.T) {
	handler, store := newTestHandler()

	event := events.SQSEvent{
		Records: []events.SQSMessage{
			{MessageId: "bad-1", Body: "not-json"},
		},
	}

	resp, err := handler.Handle(context.Background(), event)
	if err != nil {
		t.Fatalf("handle: %v", err)
	}
	if len(resp.BatchItemFailures) != 1 || resp.BatchItemFailures[0].ItemIdentifier != "bad-1" {
		t.Fatalf("batch failures: %+v", resp.BatchItemFailures)
	}
	if store.ProposalVoteCount("p1", "a") != 0 {
		t.Fatal("invalid message must not update projections")
	}
}

func TestSQSHandler_Handle_InvalidVoteRevealedReportsBatchFailure(t *testing.T) {
	handler, _ := newTestHandler()

	body := `{"event_id":"e1","event_type":"VoteRevealed","timestamp":1,"source":"voting-contract","version":1,"option_id":"yes","voter_pubkey":"v1"}`
	event := events.SQSEvent{
		Records: []events.SQSMessage{
			{MessageId: "bad-vote", Body: body},
		},
	}

	resp, err := handler.Handle(context.Background(), event)
	if err != nil {
		t.Fatalf("handle: %v", err)
	}
	if len(resp.BatchItemFailures) != 1 || resp.BatchItemFailures[0].ItemIdentifier != "bad-vote" {
		t.Fatalf("batch failures: %+v", resp.BatchItemFailures)
	}
}

func TestSQSHandler_Handle_PartialBatchFailure(t *testing.T) {
	handler, store := newTestHandler()

	good := `{"event_id":"good-1","event_type":"VoteRevealed","timestamp":1,"source":"voting-contract","version":1,"proposal_id":"p1","option_id":"a","voter_pubkey":"v1"}`
	event := events.SQSEvent{
		Records: []events.SQSMessage{
			{MessageId: "good", Body: good},
			{MessageId: "bad", Body: "not-json"},
		},
	}

	resp, err := handler.Handle(context.Background(), event)
	if err != nil {
		t.Fatalf("handle: %v", err)
	}
	if len(resp.BatchItemFailures) != 1 || resp.BatchItemFailures[0].ItemIdentifier != "bad" {
		t.Fatalf("batch failures: %+v", resp.BatchItemFailures)
	}
	if store.ProposalVoteCount("p1", "a") != 1 {
		t.Fatal("valid record in batch should still be applied")
	}
}

func TestSQSHandler_Handle_InvalidProposalCreatedReportsBatchFailure(t *testing.T) {
	handler, store := newTestHandler()

	body := `{"event_id":"pc-1","event_type":"ProposalCreated","timestamp":1,"source":"voting-contract","version":1,"proposal_id":"p9","title":"T","options":["a"]}`
	event := events.SQSEvent{
		Records: []events.SQSMessage{
			{MessageId: "skip-1", Body: body},
		},
	}

	resp, err := handler.Handle(context.Background(), event)
	if err != nil {
		t.Fatalf("handle: %v", err)
	}
	if len(resp.BatchItemFailures) != 1 {
		t.Fatalf("expected batch failure for invalid ProposalCreated, got %+v", resp.BatchItemFailures)
	}
	if store.ProposalVoteCount("p9", "a") != 0 {
		t.Fatal("invalid event must not update projections")
	}
}
