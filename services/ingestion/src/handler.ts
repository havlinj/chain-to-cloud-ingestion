import type { Handler } from "aws-lambda";

import { runIngestionCycle } from "./app/ingest.js";
import { createSolanaEventFetcher } from "./blockchain/solana-client.js";
import { loadConfig } from "./config.js";
import { createSnsPublisher } from "./publisher/sns.js";

type IngestionResponse = {
  ok: true;
  fetched: number;
  published: number;
};

export const handler: Handler = async (): Promise<IngestionResponse> => {
  const config = loadConfig();
  const fetcher = createSolanaEventFetcher(config.solanaRpcUrl);
  const publisher = createSnsPublisher(config.snsTopicArn);

  const result = await runIngestionCycle(config, fetcher, publisher);

  console.log(
    JSON.stringify({
      service: "ingestion",
      fetched: result.fetched,
      published: result.published,
    })
  );

  return {
    ok: true,
    fetched: result.fetched,
    published: result.published,
  };
};
