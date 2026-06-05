import anchor, { BorshCoder, type Idl } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

import votingIdl from "../../idl/voting.json" with { type: "json" };

const coder = new BorshCoder(votingIdl as Idl);
const programId = new PublicKey((votingIdl as { address: string }).address);

type AnchorEventName =
  | "ProposalCreated"
  | "VoteCommitted"
  | "VoteRevealed"
  | "ProposalFinalized";

function encodeAnchorEvent(name: AnchorEventName, data: Record<string, unknown>): string {
  const entry = coder.events.layouts.get(name);
  if (!entry) {
    throw new Error(`unknown Anchor event: ${name}`);
  }
  const bodyBuf = Buffer.alloc(8192);
  const bodyEnd = entry.layout.encode(data, bodyBuf, 0);
  const body = bodyBuf.subarray(0, bodyEnd);
  return Buffer.concat([Buffer.from(entry.discriminator), body]).toString("base64");
}

export function buildProgramLogs(
  anchorEventName: AnchorEventName,
  data: Record<string, unknown>,
): string[] {
  const program = programId.toBase58();
  return [
    `Program ${program} invoke [1]`,
    `Program data: ${encodeAnchorEvent(anchorEventName, data)}`,
    `Program ${program} success`,
  ];
}

export function pipelineProgramId(): string {
  return programId.toBase58();
}

export function voterPubkeyBytes(base58: string): PublicKey {
  return new PublicKey(base58);
}

export function commitmentBytes(base58: string): Uint8Array {
  return bs58.decode(base58);
}

export { anchor };
