package domain

import (
	"encoding/json"
	"errors"
	"fmt"
)

var (
	ErrInvalidJSONBody       = errors.New("invalid JSON body")
	ErrInvalidSNSMessageJSON = errors.New("invalid JSON in SNS Message field")
	ErrDecodeJSONObject      = errors.New("decode body")
	ErrEventTypeInvalidJSON  = errors.New("decode event_type")
	ErrEventTypeMissing      = errors.New("missing event_type")
)

func UnwrapEventPayload(body string) ([]byte, error) {
	raw, err := validateJSONBody(body)
	if err != nil {
		return nil, err
	}

	fields, err := decodeJSONObject(raw)
	if err != nil {
		return nil, err
	}

	return extractEventPayload(raw, fields)
}

func validateJSONBody(body string) ([]byte, error) {
	raw := []byte(body)
	if !json.Valid(raw) {
		return nil, ErrInvalidJSONBody
	}
	return raw, nil
}

func decodeJSONObject(raw []byte) (map[string]json.RawMessage, error) {
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(raw, &fields); err != nil {
		return nil, fmt.Errorf("%w: %w", ErrDecodeJSONObject, err)
	}
	return fields, nil
}

func extractEventPayload(raw []byte, fields map[string]json.RawMessage) ([]byte, error) {
	messageField, hasMessage := fields["Message"]
	if !hasMessage {
		return raw, nil
	}
	return parseSNSMessageField(messageField, raw)
}

func parseSNSMessageField(messageField json.RawMessage, fallback []byte) ([]byte, error) {
	var messageText string
	if err := json.Unmarshal(messageField, &messageText); err != nil {
		return fallback, nil
	}

	inner := []byte(messageText)
	if !json.Valid(inner) {
		return nil, ErrInvalidSNSMessageJSON
	}
	return inner, nil
}

func EventTypeFromPayload(raw []byte) (string, error) {
	var header struct {
		EventType string `json:"event_type"`
	}
	if err := json.Unmarshal(raw, &header); err != nil {
		return "", fmt.Errorf("%w: %w", ErrEventTypeInvalidJSON, err)
	}
	if header.EventType == "" {
		return "", ErrEventTypeMissing
	}
	return header.EventType, nil
}
