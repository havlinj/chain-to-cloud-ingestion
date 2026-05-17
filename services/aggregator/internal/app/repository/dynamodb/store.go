package dynamodb

import (
	"context"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"

	appcfg "github.com/chain-to-cloud/aggregator/internal/configs"
)

type Store struct {
	ProcessedEvents *ProcessedEventsRepository
	Proposals       *ProposalsRepository
	Voters          *VoterActivityRepository
}

func NewStore(ctx context.Context, cfg appcfg.Config) (*Store, error) {
	awsCfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		return nil, err
	}

	client := dynamodb.NewFromConfig(awsCfg)
	return &Store{
		ProcessedEvents: NewProcessedEventsRepository(client, cfg.ProcessedEventsTable),
		Proposals:       NewProposalsRepository(client, cfg.ProposalsTable),
		Voters:          NewVoterActivityRepository(client, cfg.VoterActivityTable),
	}, nil
}
