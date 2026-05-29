import { BorshCoder, EventParser, type Idl } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

import type { EventType, ParsedChainEvent } from "../domain/events.js";
import votingIdl from "../idl/voting.json" with { type: "json" };

const PROGRAM_ID = new PublicKey(
  (votingIdl as { address: string }).address,
);

const coder = new BorshCoder(votingIdl as Idl);
const parser = new EventParser(PROGRAM_ID, coder);

const ANCHOR_EVENT_TO_CANONICAL: Record<string, EventType> = {
  proposalCreated: "ProposalCreated",
  voteCommitted: "VoteCommitted",
  voteRevealed: "VoteRevealed",
  proposalClosed: "ProposalClosed",
  proposalFinalized: "ProposalFinalized",
  eligibleVotersRootUpdated: "EligibleVotersRootUpdated",
  voterEligibilityGranted: "VoterEligibilityGranted",
  voterEligibilityRevoked: "VoterEligibilityRevoked",
};

function encodePubkey(value: unknown): string {
  if (value instanceof PublicKey) {
    return value.toBase58();
  }
  if (value instanceof Uint8Array) {
    return bs58.encode(value);
  }
  return String(value);
}

function encodeBytes32(value: unknown): string {
  if (value instanceof Uint8Array) {
    return bs58.encode(value);
  }
  return String(value);
}

function mapAnchorEvent(
  name: string,
  data: Record<string, unknown>,
): ParsedChainEvent["payload"] | null {
  const eventType = ANCHOR_EVENT_TO_CANONICAL[name];
  if (!eventType) {
    return null;
  }

  switch (eventType) {
    case "ProposalCreated":
      return {
        proposal_id: String(data.proposalId ?? ""),
        title: String(data.title ?? ""),
        options: Array.isArray(data.options) ? data.options.map(String) : [],
        commit_ends_at: Number(data.commitEndsAt ?? 0),
        reveal_ends_at: Number(data.revealEndsAt ?? 0),
        phase: String(data.phase ?? "commit"),
        electorate_merkle_root: encodeBytes32(data.electorateMerkleRoot),
        electorate_registry_version: Number(data.electorateRegistryVersion ?? 0),
        electorate_snapshot_slot: Number(data.electorateSnapshotSlot ?? 0),
      };
    case "VoteCommitted":
      return {
        proposal_id: String(data.proposalId ?? ""),
        voter_pubkey: encodePubkey(data.voterPubkey),
        commitment: encodeBytes32(data.commitment),
      };
    case "VoteRevealed":
      return {
        proposal_id: String(data.proposalId ?? ""),
        option_id: String(data.optionId ?? ""),
        voter_pubkey: encodePubkey(data.voterPubkey),
      };
    case "ProposalClosed":
    case "ProposalFinalized":
      return {
        proposal_id: String(data.proposalId ?? ""),
      };
    case "EligibleVotersRootUpdated":
      return {
        merkle_root: encodeBytes32(data.merkleRoot),
        registry_version: Number(data.registryVersion ?? 0),
        list_hash: encodeBytes32(data.listHash),
      };
    case "VoterEligibilityGranted":
    case "VoterEligibilityRevoked":
      return {
        voter_pubkey: encodePubkey(data.voterPubkey),
      };
    default:
      return null;
  }
}

export function parseAnchorProgramLogs(
  logs: string[],
  slot: number,
  txSignature: string,
): ParsedChainEvent[] {
  const events: ParsedChainEvent[] = [];

  for (const decoded of parser.parseLogs(logs)) {
    const eventType = ANCHOR_EVENT_TO_CANONICAL[decoded.name];
    if (!eventType) {
      continue;
    }
    const payload = mapAnchorEvent(
      decoded.name,
      decoded.data as Record<string, unknown>,
    );
    if (!payload) {
      continue;
    }
    events.push({
      event_type: eventType,
      payload,
      slot,
      tx_signature: txSignature,
    });
  }

  return events;
}

export function votingProgramId(): string {
  return PROGRAM_ID.toBase58();
}
