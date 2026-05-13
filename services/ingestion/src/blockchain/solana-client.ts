import { Connection, PublicKey } from "@solana/web3.js";

import type { ParsedChainEvent } from "../domain/events.js";
import { parseProgramLogs } from "./log-parser.js";

export type ChainEventFetcher = {
  fetchRecentEvents(programId: string, lookbackSlots: number): Promise<ParsedChainEvent[]>;
};

export function createSolanaEventFetcher(rpcUrl: string): ChainEventFetcher {
  const connection = new Connection(rpcUrl, "confirmed");

  return {
    async fetchRecentEvents(programId: string, lookbackSlots: number) {
      const programKey = new PublicKey(programId);
      const currentSlot = await connection.getSlot("confirmed");
      const fromSlot = Math.max(0, currentSlot - lookbackSlots);

      const signatures = await connection.getSignaturesForAddress(programKey, {
        limit: 25,
      });

      const events: ParsedChainEvent[] = [];

      for (const signatureInfo of signatures) {
        if (signatureInfo.err) {
          continue;
        }

        if (signatureInfo.slot < fromSlot) {
          continue;
        }

        const tx = await connection.getTransaction(signatureInfo.signature, {
          commitment: "confirmed",
          maxSupportedTransactionVersion: 0,
        });

        if (!tx?.meta?.logMessages) {
          continue;
        }

        const slot = signatureInfo.slot;
        const parsed = parseProgramLogs(
          tx.meta.logMessages,
          slot,
          signatureInfo.signature,
        );
        events.push(...parsed);
      }

      return events;
    },
  };
}
