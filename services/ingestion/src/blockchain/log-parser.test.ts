import { describe, expect, it } from "vitest";

import { parseProgramLogs } from "./log-parser.js";

describe("parseProgramLogs", () => {
  it("parses JSON program logs with event_type", () => {
    const logs = [
      "Program 111 invoke [1]",
      'Program log: {"event_type":"VoteCast","proposal_id":"p1","option_id":"1","voter_pubkey":"voter1"}',
    ];

    const events = parseProgramLogs(logs, 100, "sig123");

    expect(events).toHaveLength(1);
    expect(events[0]?.event_type).toBe("VoteCast");
    expect(events[0]?.slot).toBe(100);
    expect(events[0]?.tx_signature).toBe("sig123");
  });

  it("ignores non-event program logs", () => {
    const logs = ["Program log: not-json", "Program log: {\"event_type\":\"Unknown\"}"];

    expect(parseProgramLogs(logs, 1, "sig")).toEqual([]);
  });
});
