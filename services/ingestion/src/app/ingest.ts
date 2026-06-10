import type { IngestionConfig } from "../config.js";
import type { ChainEventFetcher } from "../blockchain/solana-client.js";
import { normalizeChainEvent } from "../domain/events.js";
import type { EventPublisher } from "../publisher/sns.js";

export type IngestionResult = {
  fetched: number;
  published: number;
};

export async function runIngestionCycle(
  config: IngestionConfig,
  fetcher: ChainEventFetcher,
  publisher: EventPublisher,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): Promise<IngestionResult> {
  const parsedEvents = await fetcher.fetchRecentEvents(
    config.solanaProgramId,
    config.lookbackSlots
  );

  let published = 0;

  for (let index = 0; index < parsedEvents.length; index += 1) {
    const parsed = parsedEvents[index];
    if (!parsed) {
      continue;
    }

    const normalized = normalizeChainEvent(
      parsed,
      index,
      config.eventSource,
      config.eventVersion,
      nowSeconds
    );

    await publisher.publish(normalized);
    published += 1;
  }

  return {
    fetched: parsedEvents.length,
    published,
  };
}
