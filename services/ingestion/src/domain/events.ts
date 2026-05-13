export type EventType = "ProposalCreated" | "VoteCast" | "ProposalClosed";

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
};

export type VoteCastPayload = {
  proposal_id: string;
  option_id: string;
  voter_pubkey: string;
  slot: number;
  tx_signature: string;
};

export type ProposalClosedPayload = {
  proposal_id: string;
};

export type ChainEventPayload =
  | ProposalCreatedPayload
  | VoteCastPayload
  | ProposalClosedPayload;

export type ParsedChainEvent = {
  event_type: EventType;
  payload: Record<string, unknown>;
  slot: number;
  tx_signature: string;
};

export type VotingEvent = EventEnvelope & Record<string, unknown>;

export function isEventType(value: string): value is EventType {
  return (
    value === "ProposalCreated" ||
    value === "VoteCast" ||
    value === "ProposalClosed"
  );
}

export function buildEventId(txSignature: string, eventType: EventType, index: number): string {
  return `${txSignature}:${eventType}:${index}`;
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

  if (parsed.event_type === "VoteCast") {
    return {
      ...base,
      proposal_id: String(parsed.payload.proposal_id ?? ""),
      option_id: String(parsed.payload.option_id ?? ""),
      voter_pubkey: String(parsed.payload.voter_pubkey ?? ""),
      slot: parsed.slot,
      tx_signature: parsed.tx_signature,
    };
  }

  if (parsed.event_type === "ProposalCreated") {
    const options = parsed.payload.options;
    if (!Array.isArray(options)) {
      throw new Error("ProposalCreated requires options array");
    }

    return {
      ...base,
      proposal_id: String(parsed.payload.proposal_id ?? ""),
      title: String(parsed.payload.title ?? ""),
      options: options.map(String),
    };
  }

  return {
    ...base,
    proposal_id: String(parsed.payload.proposal_id ?? ""),
  };
}
