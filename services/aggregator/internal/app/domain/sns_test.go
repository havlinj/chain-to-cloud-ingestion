package domain_test

import (
	"errors"
	"testing"

	"github.com/chain-to-cloud/aggregator/internal/app/domain"
)

func TestUnwrapEventPayload_DirectEvent(t *testing.T) {
	raw := `{"event_type":"VoteCast","event_id":"e1"}`
	payload, err := domain.UnwrapEventPayload(raw)
	if err != nil {
		t.Fatalf("unwrap: %v", err)
	}
	if string(payload) != raw {
		t.Fatalf("payload = %s", string(payload))
	}
}

func TestUnwrapEventPayload_SNSEnvelope(t *testing.T) {
	body := `{"Type":"Notification","Message":"{\"event_type\":\"VoteCast\",\"event_id\":\"e1\"}"}`
	payload, err := domain.UnwrapEventPayload(body)
	if err != nil {
		t.Fatalf("unwrap: %v", err)
	}
	if string(payload) != `{"event_type":"VoteCast","event_id":"e1"}` {
		t.Fatalf("payload = %s", string(payload))
	}
}

func TestUnwrapEventPayload_InvalidBody(t *testing.T) {
	_, err := domain.UnwrapEventPayload("not-json")
	if !errors.Is(err, domain.ErrInvalidJSONBody) {
		t.Fatalf("got %v, want %v", err, domain.ErrInvalidJSONBody)
	}
}

func TestUnwrapEventPayload_InvalidSNSMessage(t *testing.T) {
	body := `{"Type":"Notification","Message":"not-json"}`
	_, err := domain.UnwrapEventPayload(body)
	if !errors.Is(err, domain.ErrInvalidSNSMessageJSON) {
		t.Fatalf("got %v, want %v", err, domain.ErrInvalidSNSMessageJSON)
	}
}

func TestUnwrapEventPayload_InvalidJSONObject(t *testing.T) {
	_, err := domain.UnwrapEventPayload(`[]`)
	if !errors.Is(err, domain.ErrDecodeJSONObject) {
		t.Fatalf("got %v, want %v", err, domain.ErrDecodeJSONObject)
	}
}

func TestUnwrapEventPayload_MessageNotStringUsesFallback(t *testing.T) {
	body := `{"Type":"Notification","Message":{"event_type":"VoteCast"}}`
	payload, err := domain.UnwrapEventPayload(body)
	if err != nil {
		t.Fatalf("unwrap: %v", err)
	}
	if string(payload) != body {
		t.Fatalf("payload = %s", string(payload))
	}
}
