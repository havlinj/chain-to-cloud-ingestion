import { describe, expect, it, vi } from "vitest";

import { runIngestionCycle } from "./ingest.js";
import type { IngestionConfig } from "../config.js";
import type { ChainEventFetcher } from "../blockchain/solana-client.js";
import type { EventPublisher } from "../publisher/sns.js";

const config: IngestionConfig = {
  snsTopicArn: "arn:aws:sns:eu-west-1:123:topic",
  solanaRpcUrl: "https://example.invalid",
  solanaProgramId: "Prog111",
  lookbackSlots: 10,
  eventSource: "voting-contract",
  eventVersion: 1,
};

describe("runIngestionCycle", () => {
  it("publishes normalized events from fetcher", async () => {
    const fetcher: ChainEventFetcher = {
      fetchRecentEvents: vi.fn(async () => [
        {
          event_type: "ProposalClosed",
          payload: { event_type: "ProposalClosed", proposal_id: "p1" },
          slot: 9,
          tx_signature: "sig1",
        },
      ]),
    };

    const publish = vi.fn(async () => undefined);
    const publisher: EventPublisher = { publish };

    const result = await runIngestionCycle(config, fetcher, publisher, 100);

    expect(result).toEqual({ fetched: 1, published: 1 });
    expect(publish).toHaveBeenCalledOnce();
    expect(publish.mock.calls[0]?.[0]?.event_type).toBe("ProposalClosed");
  });
});
