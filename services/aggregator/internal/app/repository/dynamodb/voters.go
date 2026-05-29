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

func (r *VoterActivityRepository) RecordVoteCommitted(ctx context.Context, event domain.VoteCommitted) error {
	_, err := r.client.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"voter_pubkey": &types.AttributeValueMemberS{Value: event.VoterPubkey},
		},
		UpdateExpression: aws.String(
			"SET last_commit_timestamp = :ts, " +
				"proposals.#pid.has_committed = :true",
		),
		ExpressionAttributeNames: map[string]string{
			"#pid": event.ProposalID,
		},
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":ts":   &types.AttributeValueMemberN{Value: fmt.Sprintf("%d", event.Timestamp)},
			":true": &types.AttributeValueMemberBOOL{Value: true},
		},
	})
	if err != nil {
		return fmt.Errorf("record VoteCommitted: %w", err)
	}
	return nil
}

func (r *VoterActivityRepository) UndoRecordVoteCommitted(ctx context.Context, event domain.VoteCommitted) error {
	_, err := r.client.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"voter_pubkey": &types.AttributeValueMemberS{Value: event.VoterPubkey},
		},
		UpdateExpression: aws.String(
			"SET proposals.#pid.has_committed = :false",
		),
		ExpressionAttributeNames: map[string]string{
			"#pid": event.ProposalID,
		},
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":false": &types.AttributeValueMemberBOOL{Value: false},
		},
	})
	if err != nil {
		return fmt.Errorf("undo VoteCommitted: %w", err)
	}
	return nil
}

func (r *VoterActivityRepository) RecordVoteRevealed(ctx context.Context, event domain.VoteRevealed) error {
	_, err := r.client.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"voter_pubkey": &types.AttributeValueMemberS{Value: event.VoterPubkey},
		},
		UpdateExpression: aws.String(
			"SET last_reveal_timestamp = :ts, " +
				"proposals.#pid.has_revealed = :true",
		),
		ExpressionAttributeNames: map[string]string{
			"#pid": event.ProposalID,
		},
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":ts":   &types.AttributeValueMemberN{Value: fmt.Sprintf("%d", event.Timestamp)},
			":true": &types.AttributeValueMemberBOOL{Value: true},
		},
	})
	if err != nil {
		return fmt.Errorf("record VoteRevealed: %w", err)
	}
	return nil
}

func (r *VoterActivityRepository) UndoRecordVoteRevealed(ctx context.Context, event domain.VoteRevealed) error {
	_, err := r.client.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"voter_pubkey": &types.AttributeValueMemberS{Value: event.VoterPubkey},
		},
		UpdateExpression: aws.String(
			"SET proposals.#pid.has_revealed = :false",
		),
		ExpressionAttributeNames: map[string]string{
			"#pid": event.ProposalID,
		},
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":false": &types.AttributeValueMemberBOOL{Value: false},
		},
	})
	if err != nil {
		return fmt.Errorf("undo VoteRevealed: %w", err)
	}
	return nil
}
