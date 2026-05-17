package dynamodb

import (
	"context"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"

	"github.com/chain-to-cloud/aggregator/internal/app/domain"
)

type ProposalsRepository struct {
	client    *dynamodb.Client
	tableName string
}

func NewProposalsRepository(client *dynamodb.Client, tableName string) *ProposalsRepository {
	return &ProposalsRepository{client: client, tableName: tableName}
}

func (r *ProposalsRepository) ApplyVoteCast(ctx context.Context, vote domain.VoteCast) error {
	input := &dynamodb.UpdateItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"proposal_id": &types.AttributeValueMemberS{Value: vote.ProposalID},
		},
		UpdateExpression: aws.String(
			"SET updated_at = :ts, #status = if_not_exists(#status, :open) " +
				"ADD total_votes :one, #counts.#option :one",
		),
		ExpressionAttributeNames: map[string]string{
			"#status": "status",
			"#counts": "option_counts",
			"#option": vote.OptionID,
		},
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":ts":   &types.AttributeValueMemberN{Value: fmt.Sprintf("%d", vote.Timestamp)},
			":open": &types.AttributeValueMemberS{Value: "open"},
			":one":  &types.AttributeValueMemberN{Value: "1"},
		},
	}

	_, err := r.client.UpdateItem(ctx, input)
	if err != nil {
		return fmt.Errorf("apply VoteCast to proposal: %w", err)
	}
	return nil
}

func (r *ProposalsRepository) UndoVoteCast(ctx context.Context, vote domain.VoteCast) error {
	input := &dynamodb.UpdateItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"proposal_id": &types.AttributeValueMemberS{Value: vote.ProposalID},
		},
		UpdateExpression: aws.String(
			"ADD total_votes :minusOne, #counts.#option :minusOne",
		),
		ExpressionAttributeNames: map[string]string{
			"#counts": "option_counts",
			"#option": vote.OptionID,
		},
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":minusOne": &types.AttributeValueMemberN{Value: "-1"},
		},
	}

	_, err := r.client.UpdateItem(ctx, input)
	if err != nil {
		return fmt.Errorf("undo VoteCast on proposal: %w", err)
	}
	return nil
}
