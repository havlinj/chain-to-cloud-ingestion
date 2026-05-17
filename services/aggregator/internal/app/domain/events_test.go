package domain_test

import (
	"errors"
	"testing"

	"github.com/chain-to-cloud/aggregator/internal/app/domain"
)

func validVoteCastJSON() []byte {
	return []byte(`{
		"event_id": "sig:VoteCast:0",
		"event_type": "VoteCast",
		"timestamp": 1700000000,
		"source": "voting-contract",
		"version": 1,
		"proposal_id": "p1",
		"option_id": "yes",
		"voter_pubkey": "voter1",
		"slot": 42,
		"tx_signature": "sig"
	}`)
}

func TestParseVoteCast_Valid(t *testing.T) {
	vote, err := domain.ParseVoteCast(validVoteCastJSON())
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if vote.ProposalID != "p1" || vote.OptionID != "yes" {
		t.Fatalf("unexpected vote: %+v", vote)
	}
}

func TestParseVoteCast_IgnoresUnknownFields(t *testing.T) {
	raw := []byte(`{
		"event_id": "e1",
		"event_type": "VoteCast",
		"timestamp": 1,
		"source": "voting-contract",
		"version": 1,
		"proposal_id": "p1",
		"option_id": "yes",
		"voter_pubkey": "voter1",
		"future_field": "ignored"
	}`)
	vote, err := domain.ParseVoteCast(raw)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if vote.ProposalID != "p1" {
		t.Fatalf("unexpected vote: %+v", vote)
	}
}

func TestParseVoteCast_InvalidJSON(t *testing.T) {
	_, err := domain.ParseVoteCast([]byte(`{`))
	if !errors.Is(err, domain.ErrVoteCastInvalidJSON) {
		t.Fatalf("got %v, want %v", err, domain.ErrVoteCastInvalidJSON)
	}
}

func TestParseVoteCast_ValidationErrors(t *testing.T) {
	tests := []struct {
		name string
		raw  string
		want error
	}{
		{
			name: "missing event_id",
			raw: `{
				"event_type": "VoteCast",
				"timestamp": 1,
				"source": "voting-contract",
				"version": 1,
				"proposal_id": "p1",
				"option_id": "yes",
				"voter_pubkey": "voter1"
			}`,
			want: domain.ErrVoteCastMissingEventID,
		},
		{
			name: "unexpected event_type",
			raw: `{
				"event_id": "e1",
				"event_type": "ProposalCreated",
				"timestamp": 1,
				"source": "voting-contract",
				"version": 1,
				"proposal_id": "p1",
				"option_id": "yes",
				"voter_pubkey": "voter1"
			}`,
			want: domain.ErrVoteCastUnexpectedEventType,
		},
		{
			name: "missing proposal_id",
			raw: `{
				"event_id": "e1",
				"event_type": "VoteCast",
				"timestamp": 1,
				"source": "voting-contract",
				"version": 1,
				"option_id": "yes",
				"voter_pubkey": "voter1"
			}`,
			want: domain.ErrVoteCastMissingProposalID,
		},
		{
			name: "missing option_id",
			raw: `{
				"event_id": "e1",
				"event_type": "VoteCast",
				"timestamp": 1,
				"source": "voting-contract",
				"version": 1,
				"proposal_id": "p1",
				"voter_pubkey": "voter1"
			}`,
			want: domain.ErrVoteCastMissingOptionID,
		},
		{
			name: "missing voter_pubkey",
			raw: `{
				"event_id": "e1",
				"event_type": "VoteCast",
				"timestamp": 1,
				"source": "voting-contract",
				"version": 1,
				"proposal_id": "p1",
				"option_id": "yes"
			}`,
			want: domain.ErrVoteCastMissingVoterPubkey,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := domain.ParseVoteCast([]byte(tt.raw))
			if !errors.Is(err, tt.want) {
				t.Fatalf("got %v, want %v", err, tt.want)
			}
		})
	}
}
