#!/usr/bin/env node
import { writeFileSync } from "fs";
import { PublicKey } from "@solana/web3.js";

import {
  buildElectorate,
  buildElectorateFromFile,
  canonicalListUtf8,
  listHashSha256Hex,
  merkleProofBase58,
  merkleProofForVoter,
  merkleProofHex,
  merkleRootBase58,
  merkleRootHex,
  parseVoterListFile,
  pubkeysBase58Sorted,
} from "./electorate.js";
import {
  grantEligibility,
  initializeRegistry,
  loadVotingProgram,
  parseBytes32,
  resolveChainConfig,
  updateMerkleRoot,
  revokeEligibility,
} from "./chain.js";

function usage(): string {
  return `eligibility-admin — voter registry admin (Merkle allowlist + on-chain updates)

List format: tools/eligibility-admin/README.md

Commands:

  build
    Offline. Read a voter list file, canonicalize it, and compute list_hash
    (SHA-256 of canonical bytes) and merkle_root for the allowlist. Does not
    connect to Solana. Use to verify a list before publishing or to inspect
    digest values without submitting a transaction.

  proof
    Offline. Given a voter list and one voter pubkey, compute the Merkle proof
    needed for commit_vote on chain. Does not connect to Solana.

  init-registry
    On-chain (once per program deploy). Create the global VoterRegistry account
    with an initial merkle_root. Requires wallet, RPC, and Anchor IDL.

  update-root
    On-chain. Recompute list_hash and merkle_root from a voter list file and
    submit update_merkle_root. Bumps registry version; affects future proposals
    only (open proposals keep their frozen electorate).

  grant
    On-chain. Add one voter to the living registry (GrantedVoter PDA + event).
    Applies to proposals created after this transaction, not open ones.

  revoke
    On-chain. Remove one voter from the living registry (RevokedVoter PDA +
    event). Applies to future proposals only.

Usage:
  eligibility-admin build --list <file> [--write-canonical <file>] [--json]
  eligibility-admin proof --list <file> --voter <base58> [--json]
  eligibility-admin init-registry --root <hex|base58> [--list-hash <hex|base58>]
  eligibility-admin update-root --list <file>
  eligibility-admin grant --voter <base58>
  eligibility-admin revoke --voter <base58>

Environment (chain commands):
  SOLANA_RPC_URL       RPC endpoint (default: http://127.0.0.1:8899)
  VOTING_PROGRAM_ID    Program id (default: devnet id from Anchor.toml)
  ANCHOR_WALLET        Authority keypair JSON path
  VOTING_IDL_PATH      Path to voting.json IDL (default: smart-contract/target/idl/voting.json)

Chain commands require \`anchor build\` in smart-contract/ so the IDL exists.
`;
}

function parseArgs(argv: string[]): { command: string; flags: Map<string, string | boolean> } {
  const args = argv.slice(2);
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log(usage());
    process.exit(0);
  }
  const command = args[0];
  const flags = new Map<string, string | boolean>();
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith("--")) {
      throw new Error(`unexpected argument: ${arg}`);
    }
    const key = arg.slice(2);
    const next = args[i + 1];
    if (!next || next.startsWith("--")) {
      flags.set(key, true);
      continue;
    }
    flags.set(key, next);
    i++;
  }
  return { command, flags };
}

function requireFlag(flags: Map<string, string | boolean>, name: string): string {
  const value = flags.get(name);
  if (typeof value !== "string" || !value) {
    throw new Error(`missing required flag: --${name}`);
  }
  return value;
}

function cmdBuild(flags: Map<string, string | boolean>): void {
  const listPath = requireFlag(flags, "list");
  const result = buildElectorateFromFile(listPath);
  const writeCanonical = flags.get("write-canonical");
  const canonicalUtf8 = canonicalListUtf8(result);
  if (typeof writeCanonical === "string") {
    writeFileSync(writeCanonical, canonicalUtf8, "utf8");
  }
  const output = {
    list_file: listPath,
    voter_count: result.entries.length,
    pubkeys_base58_sorted: pubkeysBase58Sorted(result),
    canonical_list_utf8: canonicalUtf8,
    list_hash_sha256_hex: listHashSha256Hex(result),
    merkle_root_keccak256_hex: merkleRootHex(result),
    merkle_root_base58: merkleRootBase58(result),
  };
  if (flags.has("json")) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }
  console.log("Electorate digest");
  console.log(`  voters: ${output.voter_count}`);
  console.log(`  list_hash (sha256): ${output.list_hash_sha256_hex}`);
  console.log(`  merkle_root (hex):  ${output.merkle_root_keccak256_hex}`);
  console.log(`  merkle_root (b58):  ${output.merkle_root_base58}`);
  if (typeof writeCanonical === "string") {
    console.log(`  wrote canonical list: ${writeCanonical}`);
  }
}

function cmdProof(flags: Map<string, string | boolean>): void {
  const listPath = requireFlag(flags, "list");
  const voter = requireFlag(flags, "voter");
  const electorate = buildElectorate(parseVoterListFile(listPath));
  const proof = merkleProofForVoter(electorate, voter);
  const output = {
    voter_base58: proof.voterBase58,
    leaf_index: proof.leafIndex,
    merkle_root_base58: merkleRootBase58(electorate),
    merkle_proof_base58: merkleProofBase58(proof),
    merkle_proof_hex: merkleProofHex(proof),
  };
  if (flags.has("json")) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }
  console.log(`Merkle proof for ${proof.voterBase58}`);
  console.log(`  leaf_index: ${proof.leafIndex}`);
  console.log(`  root (b58): ${merkleRootBase58(electorate)}`);
  merkleProofBase58(proof).forEach((sibling, i) => {
    console.log(`  proof[${i}]: ${sibling}`);
  });
}

async function cmdInitRegistry(flags: Map<string, string | boolean>): Promise<void> {
  const root = parseBytes32(requireFlag(flags, "root"), "root");
  const listHashInput = flags.get("list-hash");
  const listHash =
    typeof listHashInput === "string"
      ? parseBytes32(listHashInput, "list-hash")
      : new Uint8Array(32);

  const config = resolveChainConfig();
  const { program, authority } = loadVotingProgram(config);
  const signature = await initializeRegistry(program, authority, root);
  console.log("initialize_registry submitted");
  console.log(`  signature: ${signature}`);
  console.log(`  authority: ${authority.publicKey.toBase58()}`);
  console.log(`  merkle_root: ${Buffer.from(root).toString("hex")}`);
  if (typeof listHashInput === "string") {
    console.log(
      `  list_hash: ${Buffer.from(listHash).toString("hex")} (not stored on init; use update-root)`
    );
  }
}

async function cmdUpdateRoot(flags: Map<string, string | boolean>): Promise<void> {
  const listPath = requireFlag(flags, "list");
  const electorate = buildElectorateFromFile(listPath);

  const config = resolveChainConfig();
  const { program, authority } = loadVotingProgram(config);
  const signature = await updateMerkleRoot(
    program,
    authority,
    electorate.merkleRoot,
    electorate.listHash
  );
  console.log("update_merkle_root submitted");
  console.log(`  signature: ${signature}`);
  console.log(`  list_hash: ${listHashSha256Hex(electorate)}`);
  console.log(`  merkle_root: ${merkleRootHex(electorate)}`);
  console.log(`  merkle_root (b58): ${merkleRootBase58(electorate)}`);
}

async function cmdGrant(flags: Map<string, string | boolean>): Promise<void> {
  const voterBase58 = requireFlag(flags, "voter");
  const config = resolveChainConfig();
  const { program, authority } = loadVotingProgram(config);
  const voter = new PublicKey(voterBase58);
  const signature = await grantEligibility(program, authority, voter);
  console.log("grant_eligibility submitted");
  console.log(`  signature: ${signature}`);
  console.log(`  voter: ${voterBase58}`);
}

async function cmdRevoke(flags: Map<string, string | boolean>): Promise<void> {
  const voterBase58 = requireFlag(flags, "voter");
  const config = resolveChainConfig();
  const { program, authority } = loadVotingProgram(config);
  const voter = new PublicKey(voterBase58);
  const signature = await revokeEligibility(program, authority, voter);
  console.log("revoke_eligibility submitted");
  console.log(`  signature: ${signature}`);
  console.log(`  voter: ${voterBase58}`);
}

async function main(): Promise<void> {
  try {
    const { command, flags } = parseArgs(process.argv);
    switch (command) {
      case "build":
        cmdBuild(flags);
        break;
      case "proof":
        cmdProof(flags);
        break;
      case "init-registry":
        await cmdInitRegistry(flags);
        break;
      case "update-root":
        await cmdUpdateRoot(flags);
        break;
      case "grant":
        await cmdGrant(flags);
        break;
      case "revoke":
        await cmdRevoke(flags);
        break;
      default:
        throw new Error(`unknown command: ${command}\n\n${usage()}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`error: ${message}`);
    process.exit(1);
  }
}

main();
