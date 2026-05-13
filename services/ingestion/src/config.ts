export type IngestionConfig = {
  snsTopicArn: string;
  solanaRpcUrl: string;
  solanaProgramId: string;
  lookbackSlots: number;
  eventSource: string;
  eventVersion: number;
};

function readRequired(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`missing required environment variable: ${name}`);
  }
  return value;
}

function readPositiveInt(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name]?.trim();
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): IngestionConfig {
  return {
    snsTopicArn: readRequired(env, "SNS_TOPIC_ARN"),
    solanaRpcUrl: readRequired(env, "SOLANA_RPC_URL"),
    solanaProgramId: readRequired(env, "SOLANA_PROGRAM_ID"),
    lookbackSlots: readPositiveInt(env, "INGESTION_LOOKBACK_SLOTS", 50),
    eventSource: env.EVENT_SOURCE?.trim() || "voting-contract",
    eventVersion: readPositiveInt(env, "EVENT_VERSION", 1),
  };
}
