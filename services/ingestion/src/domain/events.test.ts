import { describe, expect, it } from "vitest";

import { buildEventId, normalizeChainEvent, type ParsedChainEvent } from "./events.js";

describe("normalizeChainEvent", () => {
  it("adds canonical envelope for VoteCommitted", () => {
    const parsed: ParsedChainEvent = {
      event_type: "VoteCommitted",
      payload: {
        proposal_id: "p1",
        voter_pubkey: "voter1",
        commitment: "2fHb8QiezB2CSfXhwtZ9WaJ81HCtGJhP5eXEbQCwcbuz",
      },
      slot: 42,
      tx_signature: "sig-abc",
    };

    const event = normalizeChainEvent(parsed, 0, "voting-contract", 1, 1_700_000_000);

    expect(event.event_id).toBe(buildEventId("sig-abc", "VoteCommitted", 0));
    expect(event.event_type).toBe("VoteCommitted");
    expect(event.proposal_id).toBe("p1");
    expect(event.commitment).toBe("2fHb8QiezB2CSfXhwtZ9WaJ81HCtGJhP5eXEbQCwcbuz");
    expect(event.slot).toBe(42);
  });

  it("adds canonical envelope for VoteRevealed", () => {
    const parsed: ParsedChainEvent = {
      event_type: "VoteRevealed",
      payload: {
        proposal_id: "p1",
        option_id: "yes",
        voter_pubkey: "voter1",
      },
      slot: 1,
      tx_signature: "sig",
    };

    const event = normalizeChainEvent(parsed, 0, "voting-contract", 1, 1);
    expect(event.event_type).toBe("VoteRevealed");
    expect(event.option_id).toBe("yes");
  });

  it("requires at least two options for ProposalCreated", () => {
    const parsed: ParsedChainEvent = {
      event_type: "ProposalCreated",
      payload: {
        proposal_id: "p1",
        title: "Test",
        options: ["only"],
        commit_ends_at: 1,
        reveal_ends_at: 2,
        phase: "commit",
      },
      slot: 1,
      tx_signature: "sig",
    };

    expect(() => normalizeChainEvent(parsed, 0, "voting-contract", 1, 1)).toThrow("at least two");
  });
});
