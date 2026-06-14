import { readFileSync } from "fs";
import { join, resolve } from "path";
import { describe, expect, it } from "vitest";

import { buildMerkleProof, merkleLeaf, merkleRoot, verifyMerkleProof } from "./merkle.js";

const FIXTURES_DIR = resolve(import.meta.dirname, "../../../smart-contract/tests/fixtures");

interface ElectorateGolden {
  pubkeys_hex: string[];
  merkle_leaves_keccak256_hex: string[];
  merkle_root_keccak256_hex: string;
}

function loadGolden(): ElectorateGolden {
  const raw = readFileSync(
    join(FIXTURES_DIR, "golden-0001-list-hash-and-merkle-expected.json"),
    "utf8"
  );
  return JSON.parse(raw) as ElectorateGolden;
}

describe("merkleLeaf", () => {
  it("returns keccak256 of a 32-byte pubkey (ADR 0001 golden leaves)", () => {
    const golden = loadGolden();
    golden.pubkeys_hex.forEach((hex, i) => {
      const leaf = merkleLeaf(Buffer.from(hex, "hex"));
      expect(Buffer.from(leaf).toString("hex")).toBe(golden.merkle_leaves_keccak256_hex[i]);
    });
  });

  it("rejects pubkeys that are not 32 bytes", () => {
    expect(() => merkleLeaf(new Uint8Array(31))).toThrow(/pubkey must be 32 bytes/);
  });
});

describe("merkleRoot", () => {
  it("returns the golden Merkle root for golden leaves", () => {
    const golden = loadGolden();
    const leaves = golden.merkle_leaves_keccak256_hex.map((hex) => Buffer.from(hex, "hex"));
    expect(Buffer.from(merkleRoot(leaves)).toString("hex")).toBe(golden.merkle_root_keccak256_hex);
  });

  it("rejects an empty leaf list", () => {
    expect(() => merkleRoot([])).toThrow(/merkle tree requires at least one leaf/);
  });
});

describe("buildMerkleProof", () => {
  it("builds proofs that verify against the golden root for each leaf", () => {
    const golden = loadGolden();
    const leaves = golden.merkle_leaves_keccak256_hex.map((hex) => Buffer.from(hex, "hex"));
    const root = Buffer.from(golden.merkle_root_keccak256_hex, "hex");

    for (let leafIndex = 0; leafIndex < leaves.length; leafIndex++) {
      const proof = buildMerkleProof(leaves, leafIndex);
      expect(() => verifyMerkleProof(leaves[leafIndex], proof, root, leafIndex)).not.toThrow();
    }
  });

  it("rejects an out-of-range leaf index", () => {
    const golden = loadGolden();
    const leaves = golden.merkle_leaves_keccak256_hex.map((hex) => Buffer.from(hex, "hex"));
    expect(() => buildMerkleProof(leaves, -1)).toThrow(/leaf index out of range/);
    expect(() => buildMerkleProof(leaves, leaves.length)).toThrow(/leaf index out of range/);
  });
});

describe("verifyMerkleProof", () => {
  it("rejects a proof that does not recompute to the root", () => {
    const golden = loadGolden();
    const leaves = golden.merkle_leaves_keccak256_hex.map((hex) => Buffer.from(hex, "hex"));
    const root = Buffer.from(golden.merkle_root_keccak256_hex, "hex");
    const proof = buildMerkleProof(leaves, 0);
    const tamperedSibling = Buffer.from(proof[0]);
    tamperedSibling[0] ^= 0xff;

    expect(() => verifyMerkleProof(leaves[0], [tamperedSibling, ...proof.slice(1)], root, 0)).toThrow(
      /merkle root mismatch/
    );
  });
});
