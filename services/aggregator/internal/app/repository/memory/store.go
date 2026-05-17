package memory

import (
	"context"
	"sync"

	"github.com/chain-to-cloud/aggregator/internal/app/domain"
)

type proposalState struct {
	totalVotes   int
	optionCounts map[string]int
	status       string
	updatedAt    int64
}

type voterState struct {
	votesCast         int
	lastVoteTimestamp int64
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

func (s *Store) ApplyVoteCast(_ context.Context, vote domain.VoteCast) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.applyVoteLocked(vote)
	return nil
}

func (s *Store) UndoVoteCast(_ context.Context, vote domain.VoteCast) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	state, exists := s.proposals[vote.ProposalID]
	if !exists {
		return nil
	}
	if state.totalVotes > 0 {
		state.totalVotes--
	}
	if count := state.optionCounts[vote.OptionID]; count > 0 {
		state.optionCounts[vote.OptionID] = count - 1
	}
	s.proposals[vote.ProposalID] = state
	return nil
}

func (s *Store) applyVoteLocked(vote domain.VoteCast) {
	state := s.proposals[vote.ProposalID]
	if state.optionCounts == nil {
		state.optionCounts = make(map[string]int)
	}
	if state.status == "" {
		state.status = "open"
	}
	state.totalVotes++
	state.optionCounts[vote.OptionID]++
	state.updatedAt = vote.Timestamp
	s.proposals[vote.ProposalID] = state
}

func (s *Store) RecordVoteCast(_ context.Context, vote domain.VoteCast) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	voter := s.voters[vote.VoterPubkey]
	voter.votesCast++
	voter.lastVoteTimestamp = vote.Timestamp
	s.voters[vote.VoterPubkey] = voter
	return nil
}

func (s *Store) UndoRecordVoteCast(_ context.Context, vote domain.VoteCast) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	voter, exists := s.voters[vote.VoterPubkey]
	if !exists {
		return nil
	}
	if voter.votesCast > 0 {
		voter.votesCast--
	}
	s.voters[vote.VoterPubkey] = voter
	return nil
}

func (s *Store) ProposalVoteCount(proposalID, optionID string) int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.proposals[proposalID].optionCounts[optionID]
}

func (s *Store) VoterVotesCast(voterPubkey string) int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.voters[voterPubkey].votesCast
}
