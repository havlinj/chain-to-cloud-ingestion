package memory

import (
	"context"
	"sync"

	"github.com/chain-to-cloud/aggregator/internal/app/domain"
)

type proposalState struct {
	title          string
	options        []string
	phase          string
	commitEndsAt   int64
	revealEndsAt   int64
	resultsVisible bool
	optionCounts   map[string]int
	updatedAt      int64
}

type voterProposalState struct {
	hasCommitted        bool
	hasRevealed         bool
	lastCommitTimestamp int64
	lastRevealTimestamp int64
}

type voterState struct {
	byProposal map[string]voterProposalState
}

type Store struct {
	mu        sync.Mutex
	processed map[string]struct{}
	proposals map[string]proposalState
	voters    map[string]voterState
}

func NewStore() *Store {
	return &Store{
		processed: make(map[string]struct{}),
		proposals: make(map[string]proposalState),
		voters:    make(map[string]voterState),
	}
}

func (s *Store) IsProcessed(_ context.Context, eventID string) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, exists := s.processed[eventID]
	return exists, nil
}

func (s *Store) TryMarkProcessed(_ context.Context, eventID string) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.processed[eventID]; exists {
		return true, nil
	}
	s.processed[eventID] = struct{}{}
	return false, nil
}

func (s *Store) RemoveProcessed(_ context.Context, eventID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.processed, eventID)
	return nil
}

func (s *Store) ApplyProposalCreated(_ context.Context, event domain.ProposalCreated) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	counts := make(map[string]int, len(event.Options))
	for _, opt := range event.Options {
		counts[opt] = 0
	}
	phase := event.Phase
	if phase == "" {
		phase = "commit"
	}
	s.proposals[event.ProposalID] = proposalState{
		title:          event.Title,
		options:        append([]string(nil), event.Options...),
		phase:          phase,
		commitEndsAt:   event.CommitEndsAt,
		revealEndsAt:   event.RevealEndsAt,
		resultsVisible: false,
		optionCounts:   counts,
		updatedAt:      event.Timestamp,
	}
	return nil
}

func (s *Store) ApplyVoteRevealed(_ context.Context, event domain.VoteRevealed) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	state := s.proposals[event.ProposalID]
	if state.optionCounts == nil {
		state.optionCounts = make(map[string]int)
	}
	state.optionCounts[event.OptionID]++
	if state.phase == "commit" {
		state.phase = "reveal"
	}
	state.updatedAt = event.Timestamp
	s.proposals[event.ProposalID] = state
	return nil
}

func (s *Store) UndoVoteRevealed(_ context.Context, event domain.VoteRevealed) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	state, exists := s.proposals[event.ProposalID]
	if !exists {
		return nil
	}
	if count := state.optionCounts[event.OptionID]; count > 0 {
		state.optionCounts[event.OptionID] = count - 1
	}
	s.proposals[event.ProposalID] = state
	return nil
}

func (s *Store) ApplyProposalFinalized(_ context.Context, event domain.ProposalFinalized) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	state := s.proposals[event.ProposalID]
	state.phase = "finalized"
	state.resultsVisible = true
	state.updatedAt = event.Timestamp
	s.proposals[event.ProposalID] = state
	return nil
}

func (s *Store) ApplyProposalClosed(_ context.Context, event domain.ProposalClosed) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	state := s.proposals[event.ProposalID]
	state.phase = "closed"
	state.updatedAt = event.Timestamp
	s.proposals[event.ProposalID] = state
	return nil
}

func (s *Store) RecordVoteCommitted(_ context.Context, event domain.VoteCommitted) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	voter := s.voters[event.VoterPubkey]
	if voter.byProposal == nil {
		voter.byProposal = make(map[string]voterProposalState)
	}
	part := voter.byProposal[event.ProposalID]
	part.hasCommitted = true
	part.lastCommitTimestamp = event.Timestamp
	voter.byProposal[event.ProposalID] = part
	s.voters[event.VoterPubkey] = voter
	return nil
}

func (s *Store) UndoRecordVoteCommitted(_ context.Context, event domain.VoteCommitted) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	voter, exists := s.voters[event.VoterPubkey]
	if !exists || voter.byProposal == nil {
		return nil
	}
	part := voter.byProposal[event.ProposalID]
	part.hasCommitted = false
	part.lastCommitTimestamp = 0
	voter.byProposal[event.ProposalID] = part
	s.voters[event.VoterPubkey] = voter
	return nil
}

func (s *Store) RecordVoteRevealed(_ context.Context, event domain.VoteRevealed) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	voter := s.voters[event.VoterPubkey]
	if voter.byProposal == nil {
		voter.byProposal = make(map[string]voterProposalState)
	}
	part := voter.byProposal[event.ProposalID]
	part.hasRevealed = true
	part.lastRevealTimestamp = event.Timestamp
	voter.byProposal[event.ProposalID] = part
	s.voters[event.VoterPubkey] = voter
	return nil
}

func (s *Store) UndoRecordVoteRevealed(_ context.Context, event domain.VoteRevealed) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	voter, exists := s.voters[event.VoterPubkey]
	if !exists || voter.byProposal == nil {
		return nil
	}
	part := voter.byProposal[event.ProposalID]
	part.hasRevealed = false
	part.lastRevealTimestamp = 0
	voter.byProposal[event.ProposalID] = part
	s.voters[event.VoterPubkey] = voter
	return nil
}

func (s *Store) ProposalVoteCount(proposalID, optionID string) int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.proposals[proposalID].optionCounts[optionID]
}

func (s *Store) ProposalResultsVisible(proposalID string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.proposals[proposalID].resultsVisible
}

func (s *Store) VoterHasCommitted(voterPubkey, proposalID string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.voters[voterPubkey].byProposal[proposalID].hasCommitted
}

func (s *Store) VoterHasRevealed(voterPubkey, proposalID string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.voters[voterPubkey].byProposal[proposalID].hasRevealed
}
