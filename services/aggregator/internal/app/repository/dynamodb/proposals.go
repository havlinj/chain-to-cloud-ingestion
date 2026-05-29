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

func (r *ProposalsRepository) ApplyProposalCreated(ctx context.Context, event domain.ProposalCreated) error {
	phase := event.Phase
	if phase == "" {
		phase = "commit"
	}
	counts := make(map[string]int, len(event.Options))
	for _, opt := range event.Options {
		counts[opt] = 0
	}
	countsAV := make(map[string]types.AttributeValue, len(counts))
	for opt, n := range counts {
		countsAV[opt] = &types.AttributeValueMemberN{Value: fmt.Sprintf("%d", n)}
	}

	_, err := r.client.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"proposal_id": &types.AttributeValueMemberS{Value: event.ProposalID},
		},
		UpdateExpression: aws.String(
			"SET #title = :title, #options = :options, #phase = :phase, " +
				"commit_ends_at = :commitEnds, reveal_ends_at = :revealEnds, " +
				"results_visible = :resultsVisible, option_counts = :counts, updated_at = :ts",
		),
		ExpressionAttributeNames: map[string]string{
			"#title":   "title",
			"#options": "options",
			"#phase":   "phase",
		},
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":title":           &types.AttributeValueMemberS{Value: event.Title},
			":options":         &types.AttributeValueMemberSS{Value: event.Options},
			":phase":           &types.AttributeValueMemberS{Value: phase},
			":commitEnds":      &types.AttributeValueMemberN{Value: fmt.Sprintf("%d", event.CommitEndsAt)},
			":revealEnds":      &types.AttributeValueMemberN{Value: fmt.Sprintf("%d", event.RevealEndsAt)},
			":resultsVisible":  &types.AttributeValueMemberBOOL{Value: false},
			":counts":          &types.AttributeValueMemberM{Value: countsAV},
			":ts":              &types.AttributeValueMemberN{Value: fmt.Sprintf("%d", event.Timestamp)},
		},
	})
	if err != nil {
		return fmt.Errorf("apply ProposalCreated: %w", err)
	}
	return nil
}

func (r *ProposalsRepository) ApplyVoteRevealed(ctx context.Context, event domain.VoteRevealed) error {
	_, err := r.client.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"proposal_id": &types.AttributeValueMemberS{Value: event.ProposalID},
		},
		UpdateExpression: aws.String(
			"SET updated_at = :ts, #phase = if_not_exists(#phase, :reveal) " +
				"ADD #counts.#option :one",
		),
		ExpressionAttributeNames: map[string]string{
			"#phase":   "phase",
			"#counts":  "option_counts",
			"#option":  event.OptionID,
		},
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":ts":     &types.AttributeValueMemberN{Value: fmt.Sprintf("%d", event.Timestamp)},
			":reveal": &types.AttributeValueMemberS{Value: "reveal"},
			":one":    &types.AttributeValueMemberN{Value: "1"},
		},
	})
	if err != nil {
		return fmt.Errorf("apply VoteRevealed: %w", err)
	}
	return nil
}

func (r *ProposalsRepository) UndoVoteRevealed(ctx context.Context, event domain.VoteRevealed) error {
	_, err := r.client.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"proposal_id": &types.AttributeValueMemberS{Value: event.ProposalID},
		},
		UpdateExpression: aws.String("ADD #counts.#option :minusOne"),
		ExpressionAttributeNames: map[string]string{
			"#counts": "option_counts",
			"#option": event.OptionID,
		},
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":minusOne": &types.AttributeValueMemberN{Value: "-1"},
		},
	})
	if err != nil {
		return fmt.Errorf("undo VoteRevealed: %w", err)
	}
	return nil
}

func (r *ProposalsRepository) ApplyProposalFinalized(ctx context.Context, event domain.ProposalFinalized) error {
	_, err := r.client.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"proposal_id": &types.AttributeValueMemberS{Value: event.ProposalID},
		},
		UpdateExpression: aws.String(
			"SET #phase = :finalized, results_visible = :visible, updated_at = :ts",
		),
		ExpressionAttributeNames: map[string]string{
			"#phase": "phase",
		},
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":finalized": &types.AttributeValueMemberS{Value: "finalized"},
			":visible":   &types.AttributeValueMemberBOOL{Value: true},
			":ts":        &types.AttributeValueMemberN{Value: fmt.Sprintf("%d", event.Timestamp)},
		},
	})
	if err != nil {
		return fmt.Errorf("apply ProposalFinalized: %w", err)
	}
	return nil
}

func (r *ProposalsRepository) ApplyProposalClosed(ctx context.Context, event domain.ProposalClosed) error {
	_, err := r.client.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"proposal_id": &types.AttributeValueMemberS{Value: event.ProposalID},
		},
		UpdateExpression: aws.String(
			"SET #phase = :closed, updated_at = :ts",
		),
		ExpressionAttributeNames: map[string]string{
			"#phase": "phase",
		},
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":closed": &types.AttributeValueMemberS{Value: "closed"},
			":ts":     &types.AttributeValueMemberN{Value: fmt.Sprintf("%d", event.Timestamp)},
		},
	})
	if err != nil {
		return fmt.Errorf("apply ProposalClosed: %w", err)
	}
	return nil
}
