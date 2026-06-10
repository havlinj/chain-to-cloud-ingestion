import type { ParsedChainEvent } from "../domain/events.js";
import { parseAnchorProgramLogs } from "./anchor-events.js";

export function parseProgramLogs(
  logs: string[],
  slot: number,
  txSignature: string
): ParsedChainEvent[] {
  return parseAnchorProgramLogs(logs, slot, txSignature);
}
