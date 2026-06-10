import { createHash } from "crypto";
import { keccak_256 } from "@noble/hashes/sha3";

/** SHA-256 vote commitment (ADR 0003), matches `voting-crypto::vote_commitment`. */
export function voteCommitment(
  proposalId: string,
  salt: Uint8Array,
  voterPubkey: Uint8Array,
  optionId: string
): Uint8Array {
  if (salt.length !== 32 || voterPubkey.length !== 32) {
    throw new Error("salt and voter pubkey must be 32 bytes");
  }
  return createHash("sha256")
    .update(Buffer.from(proposalId, "utf8"))
    .update(salt)
    .update(voterPubkey)
    .update(Buffer.from(optionId, "utf8"))
    .digest();
}

/** `keccak256(32-byte pubkey)` leaf (ADR 0001). */
export function merkleLeaf(pubkey: Uint8Array): Uint8Array {
  if (pubkey.length !== 32) {
    throw new Error("pubkey must be 32 bytes");
  }
  return keccak_256(pubkey);
}

function pairHash(left: Uint8Array, right: Uint8Array): Uint8Array {
  const [lo, hi] = Buffer.compare(right, left) < 0 ? [right, left] : [left, right];
  return keccak_256(Buffer.concat([Buffer.from(lo), Buffer.from(hi)]));
}

function parentLevel(level: Uint8Array[]): Uint8Array[] {
  const next: Uint8Array[] = [];
  for (let i = 0; i < level.length; i += 2) {
    const left = level[i];
    const right = i + 1 < level.length ? level[i + 1] : level[i];
    next.push(pairHash(left, right));
  }
  return next;
}

export function merkleRoot(leaves: Uint8Array[]): Uint8Array {
  if (leaves.length === 0) {
    throw new Error("merkle tree requires at least one leaf");
  }
  let level = leaves;
  while (level.length > 1) {
    level = parentLevel(level);
  }
  return level[0];
}

function siblingAt(level: Uint8Array[], index: number): Uint8Array {
  if (index % 2 === 0) {
    return index + 1 < level.length ? level[index + 1] : level[index];
  }
  return level[index - 1];
}

/** Merkle proof for `leafIndex` (matches `voting-crypto::build_merkle_proof`). */
export function buildMerkleProof(leaves: Uint8Array[], leafIndex: number): Uint8Array[] {
  const proof: Uint8Array[] = [];
  let index = leafIndex;
  let level = [...leaves];
  while (level.length > 1) {
    proof.push(siblingAt(level, index));
    level = parentLevel(level);
    index = Math.floor(index / 2);
  }
  return proof;
}

export function hexToBytes32(hex: string): Uint8Array {
  const buf = Buffer.from(hex, "hex");
  if (buf.length !== 32) {
    throw new Error(`expected 32 bytes, got ${buf.length}`);
  }
  return new Uint8Array(buf);
}

export function bytesToArray32(bytes: Uint8Array): number[] {
  if (bytes.length !== 32) {
    throw new Error("expected 32 bytes");
  }
  return Array.from(bytes);
}
