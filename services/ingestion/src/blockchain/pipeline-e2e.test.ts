import { describe, expect, it } from "vitest";

import { buildEventId, normalizeChainEvent, type ParsedChainEvent } from "../domain/events.js";
import { parseProgramLogs } from "./log-parser.js";
import {
  anchor,
  buildProgramLogs,
  commitmentBytes,
  pipelineProgramId,
  voterPubkeyBytes,
} from "./test-support/anchor-log-fixtures.js";

const SOURCE = "voting-contract";
const VERSION = 1;

// Shared scenario (matches ADR 0003 golden voter + commitment).
const PROPOSAL_ID = "e2e-pipeline-001";
const VOTER_PUBKEY = "11111111111111111111111111111112";
const OPTION_ID = "yes";
const OPTION_OTHER = "no";
const COMMITMENT = "2fHb8QiezB2CSfXhwtZ9WaJ81HCtGJhP5eXEbQCwcbuz";
const TITLE = "Pipeline E2E";
const PHASE_COMMIT = "commit";
const ELECTORATE_MERKLE_ROOT = "11111111111111111111111111111111";
const PROGRAM_ID = "BbnG5ScQxQrvZVq5FiDEgH7zx8dK6qH9jN3DEUmJSiuc";

function requireSingleParsed(parsed: ParsedChainEvent[], eventType: string): ParsedChainEvent {
  if (parsed.length !== 1) {
    throw new Error(`expected one parsed ${eventType}, got ${parsed.length}`);
  }
  const [event] = parsed;
  if (event === undefined) {
    throw new Error(`expected one parsed ${eventType}, got empty array`);
  }
  if (event.event_type !== eventType) {
    throw new Error(`expected parsed ${eventType}, got ${event.event_type}`);
  }
  return event;
}

/** Ingestion act: Anchor program logs → canonical event JSON (parseProgramLogs + normalizeChainEvent). */
function canonicalEventFromAnchorLogs(
  logs: string[],
  slot: number,
  txSignature: string,
  eventType: string,
  timestamp: number
) {
  const parsedEvent = requireSingleParsed(parseProgramLogs(logs, slot, txSignature), eventType);
  return normalizeChainEvent(parsedEvent, 0, SOURCE, VERSION, timestamp);
}

describe("pipeline E2E — parseProgramLogs + normalizeChainEvent", () => {
  it("normalizes ProposalCreated from Anchor program logs", () => {
    const eventType = "ProposalCreated";
    const slot = 100_200;
    const txSignature = "tx-pc-001";
    const timestamp = 1_700_000_000;
    const commitEndsAt = 1_700_040_000;
    const revealEndsAt = 1_700_086_400;
    const registryVersion = 1;

    const logs = buildProgramLogs(eventType, {
      proposal_id: PROPOSAL_ID,
      title: TITLE,
      options: [OPTION_ID, OPTION_OTHER],
      commit_ends_at: new anchor.BN(commitEndsAt),
      reveal_ends_at: new anchor.BN(revealEndsAt),
      phase: PHASE_COMMIT,
      electorate_merkle_root: new Uint8Array(32),
      electorate_registry_version: new anchor.BN(registryVersion),
      electorate_snapshot_slot: new anchor.BN(slot),
      slot: new anchor.BN(slot),
    });

    const normalized = canonicalEventFromAnchorLogs(logs, slot, txSignature, eventType, timestamp);

    expect(normalized.event_id).toBe(buildEventId(txSignature, eventType, 0));
    expect(normalized.event_type).toBe(eventType);
    expect(normalized.timestamp).toBe(timestamp);
    expect(normalized.source).toBe(SOURCE);
    expect(normalized.version).toBe(VERSION);
    expect(normalized.proposal_id).toBe(PROPOSAL_ID);
    expect(normalized.title).toBe(TITLE);
    expect(normalized.options).toEqual([OPTION_ID, OPTION_OTHER]);
    expect(normalized.commit_ends_at).toBe(commitEndsAt);
    expect(normalized.reveal_ends_at).toBe(revealEndsAt);
    expect(normalized.phase).toBe(PHASE_COMMIT);
    expect(normalized.electorate_merkle_root).toBe(ELECTORATE_MERKLE_ROOT);
    expect(normalized.electorate_registry_version).toBe(registryVersion);
    expect(normalized.electorate_snapshot_slot).toBe(slot);
    expect(normalized.slot).toBe(slot);
    expect(normalized.tx_signature).toBe(txSignature);
  });

  it("normalizes VoteCommitted from Anchor program logs", () => {
    const eventType = "VoteCommitted";
    const slot = 100_250;
    const txSignature = "tx-vc-001";
    const timestamp = 1_700_041_000;

    const logs = buildProgramLogs(eventType, {
      proposal_id: PROPOSAL_ID,
      voter_pubkey: voterPubkeyBytes(VOTER_PUBKEY),
      commitment: commitmentBytes(COMMITMENT),
      slot: new anchor.BN(slot),
    });

    const normalized = canonicalEventFromAnchorLogs(logs, slot, txSignature, eventType, timestamp);

    expect(normalized.event_id).toBe(buildEventId(txSignature, eventType, 0));
    expect(normalized.event_type).toBe(eventType);
    expect(normalized.timestamp).toBe(timestamp);
    expect(normalized.source).toBe(SOURCE);
    expect(normalized.version).toBe(VERSION);
    expect(normalized.proposal_id).toBe(PROPOSAL_ID);
    expect(normalized.voter_pubkey).toBe(VOTER_PUBKEY);
    expect(normalized.commitment).toBe(COMMITMENT);
    expect(normalized.slot).toBe(slot);
    expect(normalized.tx_signature).toBe(txSignature);
  });

  it("normalizes VoteRevealed from Anchor program logs", () => {
    const eventType = "VoteRevealed";
    const slot = 100_300;
    const txSignature = "tx-vr-001";
    const timestamp = 1_700_086_500;

    const logs = buildProgramLogs(eventType, {
      proposal_id: PROPOSAL_ID,
      voter_pubkey: voterPubkeyBytes(VOTER_PUBKEY),
      option_id: OPTION_ID,
      slot: new anchor.BN(slot),
    });

    const normalized = canonicalEventFromAnchorLogs(logs, slot, txSignature, eventType, timestamp);

    expect(normalized.event_id).toBe(buildEventId(txSignature, eventType, 0));
    expect(normalized.event_type).toBe(eventType);
    expect(normalized.timestamp).toBe(timestamp);
    expect(normalized.source).toBe(SOURCE);
    expect(normalized.version).toBe(VERSION);
    expect(normalized.proposal_id).toBe(PROPOSAL_ID);
    expect(normalized.option_id).toBe(OPTION_ID);
    expect(normalized.voter_pubkey).toBe(VOTER_PUBKEY);
    expect(normalized.slot).toBe(slot);
    expect(normalized.tx_signature).toBe(txSignature);
  });

  it("normalizes ProposalFinalized from Anchor program logs", () => {
    const eventType = "ProposalFinalized";
    const slot = 100_310;
    const txSignature = "tx-pf-001";
    const timestamp = 1_700_087_000;

    const logs = buildProgramLogs(eventType, {
      proposal_id: PROPOSAL_ID,
      slot: new anchor.BN(slot),
    });

    const normalized = canonicalEventFromAnchorLogs(logs, slot, txSignature, eventType, timestamp);

    expect(normalized.event_id).toBe(buildEventId(txSignature, eventType, 0));
    expect(normalized.event_type).toBe(eventType);
    expect(normalized.timestamp).toBe(timestamp);
    expect(normalized.source).toBe(SOURCE);
    expect(normalized.version).toBe(VERSION);
    expect(normalized.proposal_id).toBe(PROPOSAL_ID);
    expect(normalized.slot).toBe(slot);
    expect(normalized.tx_signature).toBe(txSignature);
  });

  it("uses the voting program id from the checked-in IDL", () => {
    expect(pipelineProgramId()).toBe(PROGRAM_ID);
  });
});
