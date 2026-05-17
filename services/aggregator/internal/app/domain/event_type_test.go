package domain_test

import (
	"errors"
	"testing"

	"github.com/chain-to-cloud/aggregator/internal/app/domain"
)

func TestEventTypeFromPayload_Valid(t *testing.T) {
	eventType, err := domain.EventTypeFromPayload([]byte(`{"event_type":"VoteCast"}`))
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if eventType != domain.EventTypeVoteCast {
		t.Fatalf("got %q, want VoteCast", eventType)
	}
}

func TestEventTypeFromPayload_InvalidJSON(t *testing.T) {
	_, err := domain.EventTypeFromPayload([]byte(`{`))
	if !errors.Is(err, domain.ErrEventTypeInvalidJSON) {
		t.Fatalf("got %v, want %v", err, domain.ErrEventTypeInvalidJSON)
	}
}

func TestEventTypeFromPayload_MissingEventType(t *testing.T) {
	_, err := domain.EventTypeFromPayload([]byte(`{"event_id":"e1"}`))
	if !errors.Is(err, domain.ErrEventTypeMissing) {
		t.Fatalf("got %v, want %v", err, domain.ErrEventTypeMissing)
	}
}
