package domain

import (
	"encoding/json"
	"errors"
	"fmt"
)

var (
	ErrEventInvalidJSON         = errors.New("decode event JSON")
	ErrEventMissingEventID      = errors.New("event missing event_id")
	ErrEventUnexpectedEventType = errors.New("unexpected event_type")
	ErrEventMissingProposalID   = errors.New("event missing proposal_id")
	ErrEventMissingVoterPubkey  = errors.New("event missing voter_pubkey")
	ErrEventMissingOptionID     = errors.New("event missing option_id")
	ErrEventMissingCommitment   = errors.New("VoteCommitted missing commitment")
	ErrProposalCreatedNoOptions = errors.New("ProposalCreated missing options")
)

const (
	EventTypeProposalCreated           = "ProposalCreated"
	EventTypeVoteCommitted             = "VoteCommitted"
	EventTypeVoteRevealed              = "VoteRevealed"
	EventTypeProposalClosed            = "ProposalClosed"
	EventTypeProposalFinalized         = "ProposalFinalized"
	EventTypeEligibleVotersRootUpdated = "EligibleVotersRootUpdated"
	EventTypeVoterEligibilityGranted   = "VoterEligibilityGranted"
	EventTypeVoterEligibilityRevoked   = "VoterEligibilityRevoked"
)

type Envelope struct {
	EventID   string `json:"event_id"`
	EventType string `json:"event_type"`
	Timestamp int64  `json:"timestamp"`
	Source    string `json:"source"`
	Version   int    `json:"version"`
}

type ProposalCreated struct {
	Envelope
	ProposalID                string   `json:"proposal_id"`
	Title                     string   `json:"title"`
	Options                   []string `json:"options"`
	CommitEndsAt              int64    `json:"commit_ends_at"`
	RevealEndsAt              int64    `json:"reveal_ends_at"`
	Phase                     string   `json:"phase"`
	ElectorateMerkleRoot      string   `json:"electorate_merkle_root,omitempty"`
	ElectorateRegistryVersion int64    `json:"electorate_registry_version,omitempty"`
	ElectorateSnapshotSlot    int64    `json:"electorate_snapshot_slot,omitempty"`
	Slot                      int64    `json:"slot"`
	TxSignature               string   `json:"tx_signature"`
}

type VoteCommitted struct {
	Envelope
	ProposalID  string `json:"proposal_id"`
	VoterPubkey string `json:"voter_pubkey"`
	Commitment  string `json:"commitment"`
	Slot        int64  `json:"slot"`
	TxSignature string `json:"tx_signature"`
}

type VoteRevealed struct {
	Envelope
	ProposalID  string `json:"proposal_id"`
	OptionID    string `json:"option_id"`
	VoterPubkey string `json:"voter_pubkey"`
	Slot        int64  `json:"slot"`
	TxSignature string `json:"tx_signature"`
}

type ProposalClosed struct {
	Envelope
	ProposalID  string `json:"proposal_id"`
	Slot        int64  `json:"slot,omitempty"`
	TxSignature string `json:"tx_signature,omitempty"`
}

type ProposalFinalized struct {
	Envelope
	ProposalID  string `json:"proposal_id"`
	Slot        int64  `json:"slot,omitempty"`
	TxSignature string `json:"tx_signature,omitempty"`
}

func ParseProposalCreated(raw []byte) (ProposalCreated, error) {
	var event ProposalCreated
	if err := json.Unmarshal(raw, &event); err != nil {
		return ProposalCreated{}, fmt.Errorf("%w: %w", ErrEventInvalidJSON, err)
	}
	if err := requireEnvelope(event.Envelope, EventTypeProposalCreated); err != nil {
		return ProposalCreated{}, err
	}
	if event.ProposalID == "" {
		return ProposalCreated{}, ErrEventMissingProposalID
	}
	if len(event.Options) < 2 {
		return ProposalCreated{}, ErrProposalCreatedNoOptions
	}
	return event, nil
}

func ParseVoteCommitted(raw []byte) (VoteCommitted, error) {
	var event VoteCommitted
	if err := json.Unmarshal(raw, &event); err != nil {
		return VoteCommitted{}, fmt.Errorf("%w: %w", ErrEventInvalidJSON, err)
	}
	if err := requireEnvelope(event.Envelope, EventTypeVoteCommitted); err != nil {
		return VoteCommitted{}, err
	}
	if event.ProposalID == "" {
		return VoteCommitted{}, ErrEventMissingProposalID
	}
	if event.VoterPubkey == "" {
		return VoteCommitted{}, ErrEventMissingVoterPubkey
	}
	if event.Commitment == "" {
		return VoteCommitted{}, ErrEventMissingCommitment
	}
	return event, nil
}

func ParseVoteRevealed(raw []byte) (VoteRevealed, error) {
	var event VoteRevealed
	if err := json.Unmarshal(raw, &event); err != nil {
		return VoteRevealed{}, fmt.Errorf("%w: %w", ErrEventInvalidJSON, err)
	}
	if err := requireEnvelope(event.Envelope, EventTypeVoteRevealed); err != nil {
		return VoteRevealed{}, err
	}
	if event.ProposalID == "" {
		return VoteRevealed{}, ErrEventMissingProposalID
	}
	if event.OptionID == "" {
		return VoteRevealed{}, ErrEventMissingOptionID
	}
	if event.VoterPubkey == "" {
		return VoteRevealed{}, ErrEventMissingVoterPubkey
	}
	return event, nil
}

func ParseProposalClosed(raw []byte) (ProposalClosed, error) {
	var event ProposalClosed
	if err := json.Unmarshal(raw, &event); err != nil {
		return ProposalClosed{}, fmt.Errorf("%w: %w", ErrEventInvalidJSON, err)
	}
	if err := requireEnvelope(event.Envelope, EventTypeProposalClosed); err != nil {
		return ProposalClosed{}, err
	}
	if event.ProposalID == "" {
		return ProposalClosed{}, ErrEventMissingProposalID
	}
	return event, nil
}

func ParseProposalFinalized(raw []byte) (ProposalFinalized, error) {
	var event ProposalFinalized
	if err := json.Unmarshal(raw, &event); err != nil {
		return ProposalFinalized{}, fmt.Errorf("%w: %w", ErrEventInvalidJSON, err)
	}
	if err := requireEnvelope(event.Envelope, EventTypeProposalFinalized); err != nil {
		return ProposalFinalized{}, err
	}
	if event.ProposalID == "" {
		return ProposalFinalized{}, ErrEventMissingProposalID
	}
	return event, nil
}

func requireEnvelope(env Envelope, want string) error {
	if env.EventID == "" {
		return ErrEventMissingEventID
	}
	if env.EventType != want {
		return fmt.Errorf("%w: %q", ErrEventUnexpectedEventType, env.EventType)
	}
	return nil
}
