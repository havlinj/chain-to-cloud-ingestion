package domain

import (
	"encoding/json"
	"errors"
	"fmt"
)

var (
	ErrVoteCastInvalidJSON         = errors.New("decode VoteCast")
	ErrVoteCastMissingEventID      = errors.New("VoteCast missing event_id")
	ErrVoteCastUnexpectedEventType = errors.New("unexpected event_type")
	ErrVoteCastMissingProposalID   = errors.New("VoteCast missing proposal_id")
	ErrVoteCastMissingOptionID     = errors.New("VoteCast missing option_id")
	ErrVoteCastMissingVoterPubkey  = errors.New("VoteCast missing voter_pubkey")
)

const (
	EventTypeVoteCast        = "VoteCast"
	EventTypeProposalCreated = "ProposalCreated"
	EventTypeProposalClosed  = "ProposalClosed"
)

type Envelope struct {
	EventID   string `json:"event_id"`
	EventType string `json:"event_type"`
	Timestamp int64  `json:"timestamp"`
	Source    string `json:"source"`
	Version   int    `json:"version"`
}

type VoteCast struct {
	Envelope
	ProposalID  string `json:"proposal_id"`
	OptionID    string `json:"option_id"`
	VoterPubkey string `json:"voter_pubkey"`
	Slot        int64  `json:"slot"`
	TxSignature string `json:"tx_signature"`
}

func ParseVoteCast(raw []byte) (VoteCast, error) {
	var vote VoteCast
	if err := json.Unmarshal(raw, &vote); err != nil {
		return VoteCast{}, fmt.Errorf("%w: %w", ErrVoteCastInvalidJSON, err)
	}
	if err := validateVoteCast(vote); err != nil {
		return VoteCast{}, err
	}
	return vote, nil
}

func validateVoteCast(vote VoteCast) error {
	if vote.EventID == "" {
		return ErrVoteCastMissingEventID
	}
	if vote.EventType != EventTypeVoteCast {
		return fmt.Errorf("%w: %q", ErrVoteCastUnexpectedEventType, vote.EventType)
	}
	if vote.ProposalID == "" {
		return ErrVoteCastMissingProposalID
	}
	if vote.OptionID == "" {
		return ErrVoteCastMissingOptionID
	}
	if vote.VoterPubkey == "" {
		return ErrVoteCastMissingVoterPubkey
	}
	return nil
}
