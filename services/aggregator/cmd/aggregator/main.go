package main

import (
	"context"
	"log/slog"
	"os"

	"github.com/aws/aws-lambda-go/lambda"

	"github.com/chain-to-cloud/aggregator/internal/app/handlers"
	"github.com/chain-to-cloud/aggregator/internal/app/repository/dynamodb"
	"github.com/chain-to-cloud/aggregator/internal/app/service"
	"github.com/chain-to-cloud/aggregator/internal/configs"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	cfg, err := configs.LoadFromEnv()
	if err != nil {
		logger.Error("load config", "service", "aggregator", "error", err)
		os.Exit(1)
	}

	store, err := dynamodb.NewStore(context.Background(), cfg)
	if err != nil {
		logger.Error("init dynamodb store", "service", "aggregator", "error", err)
		os.Exit(1)
	}

	svc := service.NewProjectionService(store.ProcessedEvents, store.Proposals, store.Voters, logger)
	handler := handlers.NewSQSHandler(svc, logger)
	lambda.Start(handler.Handle)
}
