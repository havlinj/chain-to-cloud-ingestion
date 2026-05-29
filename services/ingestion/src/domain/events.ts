export type EventType =
  | "ProposalCreated"
  | "VoteCommitted"
  | "VoteRevealed"
  | "ProposalClosed"
  | "ProposalFinalized"
  | "EligibleVotersRootUpdated"
  | "VoterEligibilityGranted"
  | "VoterEligibilityRevoked";

export type EventEnvelope = {
  event_id: string;
  event_type: EventType;
  timestamp: number;
  source: string;
  version: number;
};

export type ProposalCreatedPayload = {
  proposal_id: string;
  title: string;
  options: string[];
  commit_ends_at: number;
  reveal_ends_at: number;
  phase: string;
  electorate_merkle_root?: string;
  electorate_registry_version?: number;
  electorate_snapshot_slot?: number;
};

export type VoteCommittedPayload = {
  proposal_id: string;
  voter_pubkey: string;
  commitment: string;
};

export type VoteRevealedPayload = {
  proposal_id: string;
  option_id: string;
  voter_pubkey: string;
};

export type ProposalLifecyclePayload = {
  proposal_id: string;
};

export type EligibleVotersRootUpdatedPayload = {
  merkle_root: string;
  registry_version: number;
  list_hash: string;
};

export type VoterEligibilityPayload = {
  voter_pubkey: string;
};

export type ChainEventPayload =
  | ProposalCreatedPayload
  | VoteCommittedPayload
  | VoteRevealedPayload
  | ProposalLifecyclePayload
  | EligibleVotersRootUpdatedPayload
  | VoterEligibilityPayload;

export type ParsedChainEvent = {
  event_type: EventType;
  payload: Record<string, unknown>;
  slot: number;
  tx_signature: string;
};

export type VotingEvent = EventEnvelope & Record<string, unknown>;

const EVENT_TYPES: EventType[] = [
  "ProposalCreated",
  "VoteCommitted",
  "VoteRevealed",
  "ProposalClosed",
  "ProposalFinalized",
  "EligibleVotersRootUpdated",
  "VoterEligibilityGranted",
  "VoterEligibilityRevoked",
];

export function isEventType(value: string): value is EventType {
  return (EVENT_TYPES as string[]).includes(value);
}

export function buildEventId(
  txSignature: string,
  eventType: EventType,
  index: number,
): string {
  return `${txSignature}:${eventType}:${index}`;
}

function requireString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${key} is required`);
  }
  return value;
}

export function normalizeChainEvent(
  parsed: ParsedChainEvent,
  index: number,
  source: string,
  version: number,
  timestamp: number,
): VotingEvent {
  if (!isEventType(parsed.event_type)) {
    throw new Error(`unsupported event_type: ${parsed.event_type}`);
  }

  const base: EventEnvelope = {
    event_id: buildEventId(parsed.tx_signature, parsed.event_type, index),
    event_type: parsed.event_type,
    timestamp,
    source,
    version,
  };

  const slot = parsed.slot;
  const txSignature = parsed.tx_signature;
  const p = parsed.payload;

  switch (parsed.event_type) {
    case "ProposalCreated": {
      const options = p.options;
      if (!Array.isArray(options) || options.length < 2) {
        throw new Error("ProposalCreated requires options array with at least two entries");
      }
      return {
        ...base,
        proposal_id: requireString(p, "proposal_id"),
        title: requireString(p, "title"),
        options: options.map(String),
        commit_ends_at: Number(p.commit_ends_at ?? 0),
        reveal_ends_at: Number(p.reveal_ends_at ?? 0),
        phase: String(p.phase ?? "commit"),
        electorate_merkle_root: p.electorate_merkle_root
          ? String(p.electorate_merkle_root)
          : undefined,
        electorate_registry_version:
          p.electorate_registry_version !== undefined
            ? Number(p.electorate_registry_version)
            : undefined,
        electorate_snapshot_slot:
          p.electorate_snapshot_slot !== undefined
            ? Number(p.electorate_snapshot_slot)
            : undefined,
        slot,
        tx_signature: txSignature,
      };
    }
    case "VoteCommitted":
      return {
        ...base,
        proposal_id: requireString(p, "proposal_id"),
        voter_pubkey: requireString(p, "voter_pubkey"),
        commitment: requireString(p, "commitment"),
        slot,
        tx_signature: txSignature,
      };
    case "VoteRevealed":
      return {
        ...base,
        proposal_id: requireString(p, "proposal_id"),
        option_id: requireString(p, "option_id"),
        voter_pubkey: requireString(p, "voter_pubkey"),
        slot,
        tx_signature: txSignature,
      };
    case "ProposalClosed":
    case "ProposalFinalized":
      return {
        ...base,
        proposal_id: requireString(p, "proposal_id"),
        slot,
        tx_signature: txSignature,
      };
    case "EligibleVotersRootUpdated":
      return {
        ...base,
        merkle_root: requireString(p, "merkle_root"),
        registry_version: Number(p.registry_version ?? 0),
        list_hash: requireString(p, "list_hash"),
        slot,
        tx_signature: txSignature,
      };
    case "VoterEligibilityGranted":
    case "VoterEligibilityRevoked":
      return {
        ...base,
        voter_pubkey: requireString(p, "voter_pubkey"),
        slot,
        tx_signature: txSignature,
      };
    default:
      throw new Error(`unsupported event_type: ${parsed.event_type}`);
  }
}
