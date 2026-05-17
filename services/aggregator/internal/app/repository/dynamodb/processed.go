package dynamodb

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

type ProcessedEventsRepository struct {
	client    *dynamodb.Client
	tableName string
}

func NewProcessedEventsRepository(client *dynamodb.Client, tableName string) *ProcessedEventsRepository {
	return &ProcessedEventsRepository{client: client, tableName: tableName}
}

func (r *ProcessedEventsRepository) IsProcessed(ctx context.Context, eventID string) (bool, error) {
	out, err := r.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"event_id": &types.AttributeValueMemberS{Value: eventID},
		},
	})
	if err != nil {
		return false, fmt.Errorf("check processed event: %w", err)
	}
	return len(out.Item) > 0, nil
}

func (r *ProcessedEventsRepository) TryMarkProcessed(ctx context.Context, eventID string) (bool, error) {
	now := time.Now().UTC().Unix()
	_, err := r.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(r.tableName),
		Item: map[string]types.AttributeValue{
			"event_id":     &types.AttributeValueMemberS{Value: eventID},
			"processed_at": &types.AttributeValueMemberN{Value: fmt.Sprintf("%d", now)},
		},
		ConditionExpression: aws.String("attribute_not_exists(event_id)"),
	})
	if err == nil {
		return false, nil
	}

	var condErr *types.ConditionalCheckFailedException
	if errors.As(err, &condErr) {
		return true, nil
	}
	return false, fmt.Errorf("mark processed event: %w", err)
}

func (r *ProcessedEventsRepository) RemoveProcessed(ctx context.Context, eventID string) error {
	_, err := r.client.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"event_id": &types.AttributeValueMemberS{Value: eventID},
		},
	})
	if err != nil {
		return fmt.Errorf("remove processed event: %w", err)
	}
	return nil
}
