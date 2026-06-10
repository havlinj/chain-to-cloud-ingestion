import { BorshCoder, EventParser, type Idl } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

import { isEventType, type EventType, type ParsedChainEvent } from "../domain/events.js";
import votingIdl from "../idl/voting.json" with { type: "json" };

const PROGRAM_ID = new PublicKey((votingIdl as { address: string }).address);

const coder = new BorshCoder(votingIdl as Idl);
const parser = new EventParser(PROGRAM_ID, coder);

/** Anchor may emit PascalCase (IDL) or camelCase; canonical types are PascalCase. */
function resolveCanonicalEventType(anchorName: string): EventType | null {
  if (isEventType(anchorName)) {
    return anchorName;
  }
  if (anchorName.length === 0) {
    return null;
  }
  const pascalCase = anchorName[0]!.toUpperCase() + anchorName.slice(1);
  if (isEventType(pascalCase)) {
    return pascalCase;
  }
  return null;
}

function readField(data: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (data[key] !== undefined && data[key] !== null) {
      return data[key];
    }
  }
  return undefined;
}

function readString(data: Record<string, unknown>, ...keys: string[]): string {
  const value = readField(data, ...keys);
  if (value === undefined) {
    return "";
  }
  return String(value);
}

function readNumber(data: Record<string, unknown>, ...keys: string[]): number {
  const value = readField(data, ...keys);
  if (value === undefined) {
    return 0;
  }
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value);
}

function toByteArray(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (Array.isArray(value) && value.every((entry) => typeof entry === "number")) {
    return Uint8Array.from(value as number[]);
  }
  return null;
}

function encodePubkey(value: unknown): string {
  if (value instanceof PublicKey) {
    return value.toBase58();
  }
  const bytes = toByteArray(value);
  if (bytes !== null) {
    return bs58.encode(bytes);
  }
  return String(value);
}

function encodeBytes32(value: unknown): string {
  const bytes = toByteArray(value);
  if (bytes !== null) {
    return bs58.encode(bytes);
  }
  if (typeof value === "string") {
    return value;
  }
  return "";
}

function mapAnchorEvent(
  name: string,
  data: Record<string, unknown>
): ParsedChainEvent["payload"] | null {
  const eventType = resolveCanonicalEventType(name);
  if (!eventType) {
    return null;
  }

  switch (eventType) {
    case "ProposalCreated":
      return {
        proposal_id: readString(data, "proposal_id", "proposalId"),
        title: readString(data, "title"),
        options: Array.isArray(readField(data, "options"))
          ? (readField(data, "options") as unknown[]).map(String)
          : [],
        commit_ends_at: readNumber(data, "commit_ends_at", "commitEndsAt"),
        reveal_ends_at: readNumber(data, "reveal_ends_at", "revealEndsAt"),
        phase: readString(data, "phase") || "commit",
        electorate_merkle_root: encodeBytes32(
          readField(data, "electorate_merkle_root", "electorateMerkleRoot")
        ),
        electorate_registry_version: readNumber(
          data,
          "electorate_registry_version",
          "electorateRegistryVersion"
        ),
        electorate_snapshot_slot: readNumber(
          data,
          "electorate_snapshot_slot",
          "electorateSnapshotSlot"
        ),
      };
    case "VoteCommitted":
      return {
        proposal_id: readString(data, "proposal_id", "proposalId"),
        voter_pubkey: encodePubkey(readField(data, "voter_pubkey", "voterPubkey")),
        commitment: encodeBytes32(readField(data, "commitment")),
      };
    case "VoteRevealed":
      return {
        proposal_id: readString(data, "proposal_id", "proposalId"),
        option_id: readString(data, "option_id", "optionId"),
        voter_pubkey: encodePubkey(readField(data, "voter_pubkey", "voterPubkey")),
      };
    case "ProposalClosed":
    case "ProposalFinalized":
      return {
        proposal_id: readString(data, "proposal_id", "proposalId"),
      };
    case "EligibleVotersRootUpdated":
      return {
        merkle_root: encodeBytes32(readField(data, "merkle_root", "merkleRoot")),
        registry_version: readNumber(data, "registry_version", "registryVersion"),
        list_hash: encodeBytes32(readField(data, "list_hash", "listHash")),
      };
    case "VoterEligibilityGranted":
    case "VoterEligibilityRevoked":
      return {
        voter_pubkey: encodePubkey(readField(data, "voter_pubkey", "voterPubkey")),
      };
    default:
      return null;
  }
}

export function parseAnchorProgramLogs(
  logs: string[],
  slot: number,
  txSignature: string
): ParsedChainEvent[] {
  const events: ParsedChainEvent[] = [];

  for (const decoded of parser.parseLogs(logs)) {
    const eventType = resolveCanonicalEventType(decoded.name);
    if (!eventType) {
      continue;
    }
    const payload = mapAnchorEvent(decoded.name, decoded.data as Record<string, unknown>);
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
