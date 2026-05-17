package dynamodb

import (
	"context"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"

	"github.com/chain-to-cloud/aggregator/internal/app/domain"
)

type VoterActivityRepository struct {
	client    *dynamodb.Client
	tableName string
}

func NewVoterActivityRepository(client *dynamodb.Client, tableName string) *VoterActivityRepository {
	return &VoterActivityRepository{client: client, tableName: tableName}
}

func (r *VoterActivityRepository) RecordVoteCast(ctx context.Context, vote domain.VoteCast) error {
	_, err := r.client.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"voter_pubkey": &types.AttributeValueMemberS{Value: vote.VoterPubkey},
		},
		UpdateExpression: aws.String(
			"SET last_vote_timestamp = :ts ADD votes_cast :one",
		),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":ts":  &types.AttributeValueMemberN{Value: fmt.Sprintf("%d", vote.Timestamp)},
			":one": &types.AttributeValueMemberN{Value: "1"},
		},
	})
	if err != nil {
		return fmt.Errorf("record VoteCast voter activity: %w", err)
	}
	return nil
}

func (r *VoterActivityRepository) UndoRecordVoteCast(ctx context.Context, vote domain.VoteCast) error {
	_, err := r.client.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"voter_pubkey": &types.AttributeValueMemberS{Value: vote.VoterPubkey},
		},
		UpdateExpression: aws.String("ADD votes_cast :minusOne"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":minusOne": &types.AttributeValueMemberN{Value: "-1"},
		},
	})
	if err != nil {
		return fmt.Errorf("undo VoteCast voter activity: %w", err)
	}
	return nil
}
