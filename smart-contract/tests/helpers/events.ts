import * as anchor from "@coral-xyz/anchor";
import { BorshCoder, EventParser, Program } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { expect } from "chai";

import { simulateLogs } from "./program";

type VotingProgram = Program;

export type DecodedAnchorEvent = {
  name: string;
  data: Record<string, unknown>;
};

export function createEventParser(program: VotingProgram): EventParser {
  return new EventParser(program.programId, new BorshCoder(program.idl));
}

export function decodeEventsFromLogs(
  program: VotingProgram,
  logs: string[]
): DecodedAnchorEvent[] {
  const parser = createEventParser(program);
  const decoded: DecodedAnchorEvent[] = [];
  for (const event of parser.parseLogs(logs)) {
    decoded.push({
      name: event.name,
      data: event.data as Record<string, unknown>,
    });
  }
  return decoded;
}

export async function decodeEventsFromTransaction(
  connection: Connection,
  program: VotingProgram,
  signature: string
): Promise<DecodedAnchorEvent[]> {
  for (const commitment of ["confirmed", "finalized"] as const) {
    const tx = await connection.getTransaction(signature, {
      commitment,
      maxSupportedTransactionVersion: 0,
    });
    const logs = tx?.meta?.logMessages;
    if (logs && logs.length > 0) {
      return decodeEventsFromLogs(program, logs);
    }
  }
  return [];
}

/** Local validators often omit logMessages in getTransaction; simulation is reliable. */
export async function decodeEventsFromSimulation(
  provider: anchor.AnchorProvider,
  program: VotingProgram,
  tx: Transaction,
  signers: Keypair[] = []
): Promise<DecodedAnchorEvent[]> {
  const logs = await simulateLogs(provider, tx, signers);
  return decodeEventsFromLogs(program, logs);
}

export function expectEventNamed(
  events: DecodedAnchorEvent[],
  name: string
): DecodedAnchorEvent {
  const hit = events.find((e) => e.name === name);
  expect(hit, `expected Anchor event ${name}`).to.exist;
  return hit!;
}

export function expectPubkeyField(
  data: Record<string, unknown>,
  field: string,
  expected: PublicKey
): void {
  const value = data[field];
  if (value instanceof PublicKey) {
    expect(value.equals(expected)).to.be.true;
    return;
  }
  expect(String(value)).to.equal(expected.toBase58());
}
