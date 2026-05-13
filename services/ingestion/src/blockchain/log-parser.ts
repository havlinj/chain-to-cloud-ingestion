import type { ParsedChainEvent, EventType } from "../domain/events.js";
import { isEventType } from "../domain/events.js";

const PROGRAM_LOG_PREFIX = "Program log: ";

export function parseProgramLogs(
  logs: string[],
  slot: number,
  txSignature: string,
): ParsedChainEvent[] {
  const events: ParsedChainEvent[] = [];

  for (const line of logs) {
    const parsed = parseLogLine(line, slot, txSignature);
    if (parsed) {
      events.push(parsed);
    }
  }

  return events;
}

function parseLogLine(
  line: string,
  slot: number,
  txSignature: string,
): ParsedChainEvent | null {
  if (!line.startsWith(PROGRAM_LOG_PREFIX)) {
    return null;
  }

  const jsonText = line.slice(PROGRAM_LOG_PREFIX.length).trim();
  return parseEventJson(jsonText, slot, txSignature);
}

function parseEventJson(
  jsonText: string,
  slot: number,
  txSignature: string,
): ParsedChainEvent | null {
  let body: unknown;
  try {
    body = JSON.parse(jsonText);
  } catch {
    return null;
  }

  if (!body || typeof body !== "object") {
    return null;
  }

  const record = body as Record<string, unknown>;
  const eventType = record.event_type;
  if (typeof eventType !== "string" || !isEventType(eventType)) {
    return null;
  }

  return {
    event_type: eventType as EventType,
    payload: record,
    slot,
    tx_signature: txSignature,
  };
}
