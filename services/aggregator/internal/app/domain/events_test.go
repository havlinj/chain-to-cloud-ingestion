package domain_test

import (
	"errors"
	"testing"

	"github.com/chain-to-cloud/aggregator/internal/app/domain"
)

func validVoteRevealedJSON() []byte {
	return []byte(`{
		"event_id": "sig:VoteRevealed:0",
		"event_type": "VoteRevealed",
		"timestamp": 1700000000,
		"source": "voting-contract",
		"version": 1,
		"proposal_id": "p1",
		"option_id": "1",
		"voter_pubkey": "voter1",
		"slot": 1,
		"tx_signature": "sig"
	}`)
}

func TestParseVoteRevealed_Valid(t *testing.T) {
	event, err := domain.ParseVoteRevealed(validVoteRevealedJSON())
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if event.ProposalID != "p1" || event.OptionID != "1" {
		t.Fatalf("unexpected payload: %+v", event)
	}
}

func TestParseVoteCommitted_Valid(t *testing.T) {
	raw := []byte(`{
		"event_id": "e1",
		"event_type": "VoteCommitted",
		"timestamp": 1,
		"source": "voting-contract",
		"version": 1,
		"proposal_id": "p1",
		"voter_pubkey": "v1",
		"commitment": "abc"
	}`)
	event, err := domain.ParseVoteCommitted(raw)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if event.Commitment != "abc" {
		t.Fatalf("got commitment %q", event.Commitment)
	}
}

func TestParseProposalCreated_ValidationErrors(t *testing.T) {
	_, err := domain.ParseProposalCreated([]byte(`{
		"event_id": "e1",
		"event_type": "ProposalCreated",
		"timestamp": 1,
		"source": "voting-contract",
		"version": 1,
		"proposal_id": "p1",
		"title": "T",
		"options": ["only"]
	}`))
	if !errors.Is(err, domain.ErrProposalCreatedNoOptions) {
		t.Fatalf("got %v, want %v", err, domain.ErrProposalCreatedNoOptions)
	}
}

func TestParseVoteRevealed_IgnoresUnknownFields(t *testing.T) {
	raw := []byte(`{
		"event_id": "e1",
		"event_type": "VoteRevealed",
		"timestamp": 1,
		"source": "voting-contract",
		"version": 1,
		"proposal_id": "p1",
		"option_id": "1",
		"voter_pubkey": "v1",
		"future_field": true
	}`)
	event, err := domain.ParseVoteRevealed(raw)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if event.ProposalID != "p1" {
		t.Fatal("expected proposal_id")
	}
}
