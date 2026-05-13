import { describe, expect, it } from "vitest";

import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  it("reads required values and defaults", () => {
    const config = loadConfig({
      SNS_TOPIC_ARN: " arn:test ",
      SOLANA_RPC_URL: "https://api.devnet.solana.com",
      SOLANA_PROGRAM_ID: "Prog111",
    });

    expect(config.snsTopicArn).toBe("arn:test");
    expect(config.lookbackSlots).toBe(50);
    expect(config.eventSource).toBe("voting-contract");
    expect(config.eventVersion).toBe(1);
  });

  it("fails when required env is missing", () => {
    expect(() => loadConfig({})).toThrow("SNS_TOPIC_ARN");
  });
});
