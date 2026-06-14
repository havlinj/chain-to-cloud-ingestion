import { keccak_256 } from "@noble/hashes/sha3";

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
  if (leafIndex < 0 || leafIndex >= leaves.length) {
    throw new Error("leaf index out of range");
  }
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

/** Verify a proof for one leaf against an expected root (matches `voting-crypto::verify_merkle_proof`). */
export function verifyMerkleProof(
  leaf: Uint8Array,
  proof: Uint8Array[],
  root: Uint8Array,
  leafIndex: number
): void {
  if (proof.length === 0 && !Buffer.from(leaf).equals(Buffer.from(root))) {
    throw new Error("empty merkle proof");
  }
  let computed = leaf;
  let index = leafIndex;
  for (const sibling of proof) {
    computed = index % 2 === 0 ? pairHash(computed, sibling) : pairHash(sibling, computed);
    index = Math.floor(index / 2);
  }
  if (!Buffer.from(computed).equals(Buffer.from(root))) {
    throw new Error("merkle root mismatch");
  }
}
