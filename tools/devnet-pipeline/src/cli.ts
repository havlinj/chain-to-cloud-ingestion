#!/usr/bin/env node
import { writeFileSync } from "fs";
import { resolve } from "path";

import { bootstrapRegistry, runVotingLifecycle } from "./lifecycle.js";

function usage(): string {
  return `devnet-pipeline — devnet voting lifecycle for AWS pipeline E2E

Commands:

  bootstrap
    Ensure VoterRegistry exists and publish merkle_root + list_hash from a voter
    list file. Safe to re-run (skips init if registry already exists, always
    submits update_merkle_root when registry was already initialized).

  lifecycle
    Full commit → reveal → finalize on devnet using a voter from the list file.
    Waits for phase deadlines between steps. Emits chain events for Ingestion.

  write-voter-list
    Write the authority wallet pubkey to a one-line file (helper before
    bootstrap/lifecycle when the list should contain only your devnet wallet).

Usage:
  devnet-pipeline bootstrap --list <file>
  devnet-pipeline lifecycle --list <file> [--proposal-id <id>] [--option <id>]
    [--commit-seconds <n>] [--reveal-seconds <n>] [--json]
  devnet-pipeline write-voter-list --write-voter-list <file>

Environment:
  SOLANA_RPC_URL       RPC endpoint (default: https://api.devnet.solana.com)
  VOTING_PROGRAM_ID    Program id (default from Anchor.toml)
  ANCHOR_WALLET        Authority/voter keypair JSON path
  VOTING_IDL_PATH      Path to voting.json IDL

Requires \`anchor build\` in smart-contract/ so the IDL exists.
See docs/setup_devnet_pipeline.md for the full AWS slice runbook.
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

function readPositiveIntFlag(
  flags: Map<string, string | boolean>,
  name: string,
  fallback: number
): number {
  const raw = flags.get(name);
  if (typeof raw !== "string") {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`--${name} must be a positive integer`);
  }
  return parsed;
}

async function cmdBootstrap(flags: Map<string, string | boolean>): Promise<void> {
  const listPath = requireFlag(flags, "list");
  const result = await bootstrapRegistry({ listPath });
  console.log("registry bootstrap complete");
  console.log(`  initialized_new_registry: ${result.initialized}`);
  if (result.updateRootSignature) {
    console.log(`  update_merkle_root: ${result.updateRootSignature}`);
  }
  console.log(`  merkle_root: ${result.merkleRootHex}`);
  console.log(`  list_hash: ${result.listHashHex}`);
}

function optionalStringFlag(
  flags: Map<string, string | boolean>,
  name: string
): string | undefined {
  const value = flags.get(name);
  return typeof value === "string" ? value : undefined;
}

async function cmdLifecycle(flags: Map<string, string | boolean>): Promise<void> {
  const listPath = requireFlag(flags, "list");
  const proposalId = optionalStringFlag(flags, "proposal-id") ?? `pipeline-${Date.now()}`;
  const optionId = optionalStringFlag(flags, "option") ?? "1";
  const commitSeconds = readPositiveIntFlag(flags, "commit-seconds", 20);
  const revealSeconds = readPositiveIntFlag(flags, "reveal-seconds", 50);

  if (revealSeconds <= commitSeconds) {
    throw new Error("--reveal-seconds must be greater than --commit-seconds");
  }

  const result = await runVotingLifecycle({
    listPath,
    proposalId,
    title: "Devnet pipeline slice",
    options: ["1", "2"],
    optionId,
    commitSecondsFromNow: commitSeconds,
    revealSecondsFromNow: revealSeconds,
  });

  const output = {
    proposal_id: result.proposalId,
    voter_pubkey: result.voterPubkey,
    commit_ends_at: result.commitEndsAt,
    reveal_ends_at: result.revealEndsAt,
    signatures: {
      create_proposal: result.createSignature,
      commit_vote: result.commitSignature,
      reveal_vote: result.revealSignature,
      finalize_proposal: result.finalizeSignature,
    },
  };

  if (flags.has("json")) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log("voting lifecycle complete");
  console.log(`  proposal_id: ${result.proposalId}`);
  console.log(`  voter: ${result.voterPubkey}`);
  console.log(`  create_proposal: ${result.createSignature}`);
  console.log(`  commit_vote: ${result.commitSignature}`);
  console.log(`  reveal_vote: ${result.revealSignature}`);
  console.log(`  finalize_proposal: ${result.finalizeSignature}`);
  console.log("");
  console.log(
    "Next: invoke Ingestion Lambda and verify DynamoDB (see docs/setup_devnet_pipeline.md)"
  );
}

async function cmdWriteVoterList(flags: Map<string, string | boolean>): Promise<void> {
  const outPath = requireFlag(flags, "write-voter-list");
  const { loadVotingProgram, resolveChainConfig } = await import("./chain.js");
  const { program, authority } = loadVotingProgram(resolveChainConfig());
  const pubkey = authority.publicKey.toBase58();
  writeFileSync(resolve(outPath), `${pubkey}\n`, "utf8");
  console.log(`wrote voter list (${program.programId.toBase58()} electorate): ${outPath}`);
  console.log(`  voter: ${pubkey}`);
}

async function main(): Promise<void> {
  try {
    const { command, flags } = parseArgs(process.argv);
    switch (command) {
      case "bootstrap":
        await cmdBootstrap(flags);
        break;
      case "lifecycle":
        await cmdLifecycle(flags);
        break;
      case "write-voter-list":
        await cmdWriteVoterList(flags);
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
