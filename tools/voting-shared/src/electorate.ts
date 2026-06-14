import { createHash } from "crypto";
import { readFileSync } from "fs";
import { PublicKey } from "@solana/web3.js";

import { buildMerkleProof, merkleLeaf, merkleRoot } from "./merkle.js";

export interface VoterEntry {
  bytes: Uint8Array;
}

export interface ElectorateBuildResult {
  entries: VoterEntry[];
  canonicalListBytes: Uint8Array;
  listHash: Uint8Array;
  merkleLeaves: Uint8Array[];
  merkleRoot: Uint8Array;
}

export interface MerkleProofResult {
  voterBase58: string;
  leafIndex: number;
  merkleProof: Uint8Array[];
}

export function voterBase58(entry: VoterEntry): string {
  return new PublicKey(entry.bytes).toBase58();
}

export function bytes32Hex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

export function bytes32Base58(bytes: Uint8Array): string {
  return new PublicKey(bytes).toBase58();
}

export function canonicalListUtf8(result: ElectorateBuildResult): string {
  return Buffer.from(result.canonicalListBytes).toString("utf8");
}

export function pubkeysBase58Sorted(result: ElectorateBuildResult): string[] {
  return result.entries.map(voterBase58);
}

export function listHashSha256Hex(result: ElectorateBuildResult): string {
  return bytes32Hex(result.listHash);
}

export function merkleRootHex(result: ElectorateBuildResult): string {
  return bytes32Hex(result.merkleRoot);
}

export function merkleRootBase58(result: ElectorateBuildResult): string {
  return bytes32Base58(result.merkleRoot);
}

export function merkleLeavesHex(result: ElectorateBuildResult): string[] {
  return result.merkleLeaves.map(bytes32Hex);
}

export function merkleProofHex(proof: MerkleProofResult): string[] {
  return proof.merkleProof.map(bytes32Hex);
}

export function merkleProofBase58(proof: MerkleProofResult): string[] {
  return proof.merkleProof.map(bytes32Base58);
}

function parsePubkeyLine(line: string, lineNumber: number): VoterEntry {
  const trimmed = line.trim();
  if (!trimmed) {
    throw new Error(`line ${lineNumber}: empty pubkey`);
  }
  let pubkey: PublicKey;
  try {
    pubkey = new PublicKey(trimmed);
  } catch {
    throw new Error(`line ${lineNumber}: invalid base58 pubkey "${trimmed}"`);
  }
  return { bytes: pubkey.toBytes() };
}

/** Parse voter list file: non-empty lines as base58 pubkeys, sorted lexicographically. */
export function parseVoterListContent(content: string): VoterEntry[] {
  const lines = content.split(/\r?\n/);
  const entries: VoterEntry[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) {
      continue;
    }
    entries.push(parsePubkeyLine(line, i + 1));
  }
  if (entries.length === 0) {
    throw new Error("voter list is empty");
  }
  const seen = new Set<string>();
  for (const entry of entries) {
    const base58 = voterBase58(entry);
    if (seen.has(base58)) {
      throw new Error(`duplicate pubkey in list: ${base58}`);
    }
    seen.add(base58);
  }
  return entries.sort((a, b) => voterBase58(a).localeCompare(voterBase58(b)));
}

export function parseVoterListFile(path: string): VoterEntry[] {
  const content = readFileSync(path, "utf8");
  return parseVoterListContent(content);
}

/** Build list_hash and Merkle root from sorted voter entries. */
export function buildElectorate(entries: VoterEntry[]): ElectorateBuildResult {
  const pubkeysBase58 = entries.map(voterBase58);
  const canonicalListBytes = Buffer.from(pubkeysBase58.join("\n"), "utf8");
  const listHash = createHash("sha256").update(canonicalListBytes).digest();
  const merkleLeaves = entries.map((e) => merkleLeaf(e.bytes));
  const root = merkleRoot(merkleLeaves);

  return {
    entries,
    canonicalListBytes: new Uint8Array(canonicalListBytes),
    listHash: new Uint8Array(listHash),
    merkleLeaves,
    merkleRoot: root,
  };
}

export function buildElectorateFromFile(path: string): ElectorateBuildResult {
  return buildElectorate(parseVoterListFile(path));
}

export function merkleProofForVoter(
  electorate: ElectorateBuildResult,
  voter: string
): MerkleProofResult {
  const index = electorate.entries.findIndex((e) => voterBase58(e) === voter);
  if (index < 0) {
    throw new Error(`voter not in electorate: ${voter}`);
  }
  return {
    voterBase58: voter,
    leafIndex: index,
    merkleProof: buildMerkleProof(electorate.merkleLeaves, index),
  };
}
