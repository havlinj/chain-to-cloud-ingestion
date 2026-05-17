package configs_test

import (
	"strings"
	"testing"

	"github.com/chain-to-cloud/aggregator/internal/configs"
)

func TestLoadFromEnv_Valid(t *testing.T) {
	t.Setenv("DYNAMODB_PROPOSALS_TABLE", "proposals")
	t.Setenv("DYNAMODB_VOTER_ACTIVITY_TABLE", "voters")
	t.Setenv("DYNAMODB_PROCESSED_EVENTS_TABLE", "processed")

	cfg, err := configs.LoadFromEnv()
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if cfg.ProposalsTable != "proposals" {
		t.Fatalf("proposals table = %q", cfg.ProposalsTable)
	}
}

func TestLoadFromEnv_MissingVariables(t *testing.T) {
	tests := []struct {
		name    string
		unset   string
		wantErr string
	}{
		{
			name:    "missing proposals table",
			unset:   "DYNAMODB_PROPOSALS_TABLE",
			wantErr: "DYNAMODB_PROPOSALS_TABLE",
		},
		{
			name:    "missing voter activity table",
			unset:   "DYNAMODB_VOTER_ACTIVITY_TABLE",
			wantErr: "DYNAMODB_VOTER_ACTIVITY_TABLE",
		},
		{
			name:    "missing processed events table",
			unset:   "DYNAMODB_PROCESSED_EVENTS_TABLE",
			wantErr: "DYNAMODB_PROCESSED_EVENTS_TABLE",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("DYNAMODB_PROPOSALS_TABLE", "proposals")
			t.Setenv("DYNAMODB_VOTER_ACTIVITY_TABLE", "voters")
			t.Setenv("DYNAMODB_PROCESSED_EVENTS_TABLE", "processed")
			t.Setenv(tt.unset, "")

			_, err := configs.LoadFromEnv()
			if err == nil {
				t.Fatal("expected error")
			}
			if !strings.Contains(err.Error(), tt.wantErr) {
				t.Fatalf("got %v", err)
			}
		})
	}
}
