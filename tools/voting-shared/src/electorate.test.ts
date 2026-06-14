import { readFileSync } from "fs";
import { join, resolve } from "path";
import { describe, expect, it } from "vitest";

import {
  buildElectorate,
  buildElectorateFromFile,
  bytes32Base58,
  bytes32Hex,
  canonicalListUtf8,
  listHashSha256Hex,
  merkleLeavesHex,
  merkleProofBase58,
  merkleProofForVoter,
  merkleProofHex,
  merkleRootBase58,
  merkleRootHex,
  parseVoterListContent,
  parseVoterListFile,
  pubkeysBase58Sorted,
  voterBase58,
} from "./electorate.js";
import { buildMerkleProof, verifyMerkleProof } from "./merkle.js";

const FIXTURES_DIR = resolve(import.meta.dirname, "../../../smart-contract/tests/fixtures");

/** Proof siblings (hex) per golden voter; derived from golden-0001 leaves + ADR 0001 pair rule. */
const GOLDEN_PROOFS_HEX: Record<string, string[]> = {
  "11111111111111111111111111111112": [
    "405787fa12a823e0f2b7631cc41b3ba8828b3321ca811111fa75cd3aa3bb5ace",
    "6b78d84397233ca2a608c0b3bc98a725522712d3187b17d12cc2da113a74ef6b",
  ],
  "11111111111111111111111111111113": [
    "b10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf6",
    "6b78d84397233ca2a608c0b3bc98a725522712d3187b17d12cc2da113a74ef6b",
  ],
  "11111111111111111111111111111114": [
    "c2575a0e9e593c00f959f8c92f12db2869c3395a3b0502d05e2516446f71f85b",
    "2a171b5bcd1449348c3e09a5424946b5e6d6f5471221941d585131d673952ee4",
  ],
};

const GOLDEN_PROOFS_BASE58: Record<string, string[]> = {
  "11111111111111111111111111111112": [
    "5LAWL2wKCLdK9J3s1BzuEoBvyYSBnKrWshxcseCYcznH",
    "8EXVxyUuf7fkkErXviakvbHojFhQe7TVDTMJRcC4pEo4",
  ],
  "11111111111111111111111111111113": [
    "Cv9heKcE6CsgPH6R2yF9uzCNDqJWNqUVwKDjtWpTeevy",
    "8EXVxyUuf7fkkErXviakvbHojFhQe7TVDTMJRcC4pEo4",
  ],
  "11111111111111111111111111111114": [
    "E5dMAkqapFDGamhK81CJqy2GAqPRBuwxeVJp3bZfYmwx",
    "3qJZRwdnYoVWTdtq9FcimJmtskGSLcexDsELfTPuVLZR",
  ],
};

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

function goldenElectorate() {
  return buildElectorate(parseVoterListContent(loadGolden().canonical_list_utf8));
}

describe("parseVoterListContent", () => {
  it("parses and sorts pubkeys from multiline content", () => {
    const golden = loadGolden();
    const reversed = [...golden.pubkeys_base58_sorted].reverse().join("\n");
    expect(parseVoterListContent(reversed).map(voterBase58)).toEqual(
      golden.pubkeys_base58_sorted
    );
  });

  it("ignores blank lines between valid pubkeys", () => {
    const golden = loadGolden();
    const withBlankLines = golden.pubkeys_base58_sorted.join("\n\n");
    expect(parseVoterListContent(withBlankLines).map(voterBase58)).toEqual(
      golden.pubkeys_base58_sorted
    );
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
    expect(() => parseVoterListContent("not-valid-base58!!!")).toThrow(/invalid base58 pubkey/);
  });
});

describe("parseVoterListFile", () => {
  it("reads and parses a voter list file", () => {
    const golden = loadGolden();
    const listPath = join(FIXTURES_DIR, "golden-0001-voter-list-input.txt");
    expect(parseVoterListFile(listPath).map(voterBase58)).toEqual(golden.pubkeys_base58_sorted);
  });
});

describe("buildElectorate", () => {
  it("builds golden list_hash and Merkle root from sorted entries", () => {
    const golden = loadGolden();
    const result = buildElectorate(parseVoterListContent(golden.canonical_list_utf8));

    expect(canonicalListUtf8(result)).toBe(golden.canonical_list_utf8);
    expect(listHashSha256Hex(result)).toBe(golden.list_hash_sha256_hex);
    expect(merkleRootHex(result)).toBe(golden.merkle_root_keccak256_hex);
    expect(merkleRootBase58(result)).toBe(golden.merkle_root_base58);
    expect(merkleLeavesHex(result)).toEqual(golden.merkle_leaves_keccak256_hex);
    expect(pubkeysBase58Sorted(result)).toEqual(golden.pubkeys_base58_sorted);
  });
});

describe("buildElectorateFromFile", () => {
  it("builds electorate from a fixture file path", () => {
    const golden = loadGolden();
    const listPath = join(FIXTURES_DIR, "golden-0001-voter-list-input.txt");
    const result = buildElectorateFromFile(listPath);
    expect(listHashSha256Hex(result)).toBe(golden.list_hash_sha256_hex);
    expect(merkleRootHex(result)).toBe(golden.merkle_root_keccak256_hex);
  });
});

describe("electorate format helpers", () => {
  it("formats golden electorate fields for CLI output", () => {
    const golden = loadGolden();
    const electorate = goldenElectorate();
    const firstVoter = golden.pubkeys_base58_sorted[0];

    expect(voterBase58(electorate.entries[0])).toBe(firstVoter);
    expect(bytes32Hex(electorate.listHash)).toBe(golden.list_hash_sha256_hex);
    expect(bytes32Base58(electorate.merkleRoot)).toBe(golden.merkle_root_base58);
    expect(canonicalListUtf8(electorate)).toBe(golden.canonical_list_utf8);
    expect(pubkeysBase58Sorted(electorate)).toEqual(golden.pubkeys_base58_sorted);
    expect(listHashSha256Hex(electorate)).toBe(golden.list_hash_sha256_hex);
    expect(merkleRootHex(electorate)).toBe(golden.merkle_root_keccak256_hex);
    expect(merkleRootBase58(electorate)).toBe(golden.merkle_root_base58);
    expect(merkleLeavesHex(electorate)).toEqual(golden.merkle_leaves_keccak256_hex);
  });
});

describe("merkleProofForVoter", () => {
  it("builds golden proofs that verify against the electorate root", () => {
    const golden = loadGolden();
    const electorate = goldenElectorate();

    for (const voter of golden.pubkeys_base58_sorted) {
      const proofResult = merkleProofForVoter(electorate, voter);
      const directProof = buildMerkleProof(electorate.merkleLeaves, proofResult.leafIndex);

      expect(merkleProofHex(proofResult)).toEqual(GOLDEN_PROOFS_HEX[voter]);
      expect(merkleProofHex(proofResult)).toEqual(
        directProof.map((sibling) => Buffer.from(sibling).toString("hex"))
      );
      expect(() =>
        verifyMerkleProof(
          electorate.merkleLeaves[proofResult.leafIndex],
          proofResult.merkleProof,
          electorate.merkleRoot,
          proofResult.leafIndex
        )
      ).not.toThrow();
    }
  });

  it("rejects a voter not in the electorate", () => {
    expect(() => merkleProofForVoter(goldenElectorate(), "11111111111111111111111111111115")).toThrow(
      /voter not in electorate/
    );
  });
});

describe("merkleProofHex", () => {
  it("formats golden proof siblings as hex", () => {
    const voter = loadGolden().pubkeys_base58_sorted[0];
    const proof = merkleProofForVoter(goldenElectorate(), voter);
    expect(merkleProofHex(proof)).toEqual(GOLDEN_PROOFS_HEX[voter]);
  });
});

describe("merkleProofBase58", () => {
  it("formats golden proof siblings as base58", () => {
    const golden = loadGolden();
    for (const voter of golden.pubkeys_base58_sorted) {
      const proof = merkleProofForVoter(goldenElectorate(), voter);
      expect(merkleProofBase58(proof)).toEqual(GOLDEN_PROOFS_BASE58[voter]);
    }
  });
});
