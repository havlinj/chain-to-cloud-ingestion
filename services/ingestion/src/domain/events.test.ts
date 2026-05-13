import { describe, expect, it } from "vitest";

import {
  buildEventId,
  normalizeChainEvent,
  type ParsedChainEvent,
} from "./events.js";

describe("normalizeChainEvent", () => {
  it("adds canonical envelope for VoteCast", () => {
    const parsed: ParsedChainEvent = {
      event_type: "VoteCast",
      payload: {
        event_type: "VoteCast",
        proposal_id: "p1",
        option_id: "2",
        voter_pubkey: "voter1",
      },
      slot: 42,
      tx_signature: "sig-abc",
    };

    const event = normalizeChainEvent(parsed, 0, "voting-contract", 1, 1_700_000_000);

    expect(event.event_id).toBe(buildEventId("sig-abc", "VoteCast", 0));
    expect(event.event_type).toBe("VoteCast");
    expect(event.source).toBe("voting-contract");
    expect(event.version).toBe(1);
    expect(event.proposal_id).toBe("p1");
    expect(event.slot).toBe(42);
    expect(event.tx_signature).toBe("sig-abc");
  });

  it("requires options array for ProposalCreated", () => {
    const parsed: ParsedChainEvent = {
      event_type: "ProposalCreated",
      payload: {
        event_type: "ProposalCreated",
        proposal_id: "p1",
        title: "Test",
      },
      slot: 1,
      tx_signature: "sig",
    };

    expect(() => normalizeChainEvent(parsed, 0, "voting-contract", 1, 1)).toThrow(
      "ProposalCreated requires options array",
    );
  });
});
