import { readFileSync } from "fs";
import { join, resolve } from "path";
import { describe, expect, it } from "vitest";

import {
  buildElectorate,
  buildElectorateFromFile,
  canonicalListUtf8,
  listHashSha256Hex,
  merkleLeavesHex,
  merkleProofForVoter,
  merkleProofHex,
  merkleRootBase58,
  merkleRootHex,
  parseVoterListContent,
  pubkeysBase58Sorted,
} from "./electorate.js";
import { buildMerkleProof } from "./merkle.js";

const FIXTURES_DIR = resolve(
  import.meta.dirname,
  "../../../smart-contract/tests/fixtures"
);

interface ElectorateGolden {
  canonical_list_utf8: string;
  list_hash_sha256_hex: string;
  pubkeys_base58_sorted: string[];
  merkle_leaves_keccak256_hex: string[];
  merkle_root_keccak256_hex: string;
  merkle_root_base58: string;
}

function loadGolden(): ElectorateGolden {
  const raw = readFileSync(
    join(FIXTURES_DIR, "golden-0001-list-hash-and-merkle-expected.json"),
    "utf8"
  );
  return JSON.parse(raw) as ElectorateGolden;
}

describe("electorate", () => {
  it("matches golden list_hash and merkle root from fixture file", () => {
    const golden = loadGolden();
    const listPath = join(FIXTURES_DIR, "golden-0001-voter-list-input.txt");
    const result = buildElectorateFromFile(listPath);

    expect(canonicalListUtf8(result)).toBe(golden.canonical_list_utf8);
    expect(listHashSha256Hex(result)).toBe(golden.list_hash_sha256_hex);
    expect(merkleRootHex(result)).toBe(golden.merkle_root_keccak256_hex);
    expect(merkleRootBase58(result)).toBe(golden.merkle_root_base58);
    expect(merkleLeavesHex(result)).toEqual(golden.merkle_leaves_keccak256_hex);
    expect(pubkeysBase58Sorted(result)).toEqual(golden.pubkeys_base58_sorted);
  });

  it("sorts unsorted input lines by base58 lexicographic order", () => {
    const golden = loadGolden();
    const reversed = [...golden.pubkeys_base58_sorted].reverse().join("\n");
    const entries = parseVoterListContent(reversed);
    const result = buildElectorate(entries);
    expect(listHashSha256Hex(result)).toBe(golden.list_hash_sha256_hex);
    expect(merkleRootHex(result)).toBe(golden.merkle_root_keccak256_hex);
  });

  it("builds verifiable merkle proofs for each golden voter", () => {
    const golden = loadGolden();
    const electorate = buildElectorate(parseVoterListContent(golden.canonical_list_utf8));

    for (const voter of golden.pubkeys_base58_sorted) {
      const proofResult = merkleProofForVoter(electorate, voter);
      const proof = buildMerkleProof(electorate.merkleLeaves, proofResult.leafIndex);
      expect(merkleProofHex(proofResult)).toEqual(
        proof.map((p) => Buffer.from(p).toString("hex"))
      );
      expect(proofResult.leafIndex).toBeGreaterThanOrEqual(0);
      expect(electorate.merkleRoot.length).toBe(32);
    }
  });

  it("rejects duplicate pubkeys", () => {
    const golden = loadGolden();
    const duped = `${golden.pubkeys_base58_sorted[0]}\n${golden.pubkeys_base58_sorted[0]}`;
    expect(() => parseVoterListContent(duped)).toThrow(/duplicate/);
  });

  it("rejects an empty voter list", () => {
    expect(() => parseVoterListContent("")).toThrow(/voter list is empty/);
    expect(() => parseVoterListContent("\n\n  \n")).toThrow(/voter list is empty/);
  });

  it("rejects invalid base58 pubkeys", () => {
    expect(() => parseVoterListContent("not-valid-base58!!!")).toThrow(
      /invalid base58 pubkey/
    );
  });

  it("ignores blank lines between valid pubkeys", () => {
    const golden = loadGolden();
    const withBlankLines = golden.pubkeys_base58_sorted.join("\n\n");
    const result = buildElectorate(parseVoterListContent(withBlankLines));
    expect(listHashSha256Hex(result)).toBe(golden.list_hash_sha256_hex);
  });

  it("rejects merkle proof for a voter not in the electorate", () => {
    const golden = loadGolden();
    const electorate = buildElectorate(parseVoterListContent(golden.canonical_list_utf8));
    expect(() =>
      merkleProofForVoter(electorate, "11111111111111111111111111111115")
    ).toThrow(/voter not in electorate/);
  });
});
