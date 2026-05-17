package configs

import (
	"fmt"
	"os"
)

type Config struct {
	ProposalsTable       string
	VoterActivityTable   string
	ProcessedEventsTable string
}

func LoadFromEnv() (Config, error) {
	cfg := Config{
		ProposalsTable:       os.Getenv("DYNAMODB_PROPOSALS_TABLE"),
		VoterActivityTable:   os.Getenv("DYNAMODB_VOTER_ACTIVITY_TABLE"),
		ProcessedEventsTable: os.Getenv("DYNAMODB_PROCESSED_EVENTS_TABLE"),
	}

	if cfg.ProposalsTable == "" {
		return Config{}, fmt.Errorf("missing required environment variable: DYNAMODB_PROPOSALS_TABLE")
	}
	if cfg.VoterActivityTable == "" {
		return Config{}, fmt.Errorf("missing required environment variable: DYNAMODB_VOTER_ACTIVITY_TABLE")
	}
	if cfg.ProcessedEventsTable == "" {
		return Config{}, fmt.Errorf("missing required environment variable: DYNAMODB_PROCESSED_EVENTS_TABLE")
	}

	return cfg, nil
}
