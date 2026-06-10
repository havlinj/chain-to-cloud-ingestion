import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { readFileSync } from "fs";
import { homedir } from "os";
import { join, resolve } from "path";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";

import { grantedVoterPda, revokedVoterPda, voterRegistryPda } from "./pda.js";

type VotingProgram = Program;

const DEFAULT_PROGRAM_ID = "VotiNG1111111111111111111111111111111111111";
const PACKAGE_ROOT = resolve(import.meta.dirname, "..");

export interface ChainConfig {
  rpcUrl: string;
  programId: PublicKey;
  walletPath: string;
  idlPath: string;
}

function chainConfigDefaults(): ChainConfig {
  return {
    rpcUrl: "http://127.0.0.1:8899",
    programId: new PublicKey(DEFAULT_PROGRAM_ID),
    walletPath: join(homedir(), ".config", "solana", "id.json"),
    idlPath: resolve(PACKAGE_ROOT, "../../smart-contract/target/idl/voting.json"),
  };
}

function chainConfigFromEnv(): Partial<ChainConfig> {
  const { SOLANA_RPC_URL, VOTING_PROGRAM_ID, ANCHOR_WALLET, VOTING_IDL_PATH } = process.env;

  return {
    ...(SOLANA_RPC_URL !== undefined && { rpcUrl: SOLANA_RPC_URL }),
    ...(VOTING_PROGRAM_ID !== undefined && {
      programId: new PublicKey(VOTING_PROGRAM_ID),
    }),
    ...(ANCHOR_WALLET !== undefined && { walletPath: ANCHOR_WALLET }),
    ...(VOTING_IDL_PATH !== undefined && { idlPath: VOTING_IDL_PATH }),
  };
}

export function resolveChainConfig(overrides: Partial<ChainConfig> = {}): ChainConfig {
  return {
    ...chainConfigDefaults(),
    ...chainConfigFromEnv(),
    ...overrides,
  };
}

function loadWalletKeypair(path: string): Keypair {
  const secret = JSON.parse(readFileSync(path, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

export function loadVotingProgram(config: ChainConfig): {
  program: VotingProgram;
  authority: Keypair;
} {
  const idl = JSON.parse(readFileSync(config.idlPath, "utf8")) as {
    address?: string;
    [key: string]: unknown;
  };
  idl.address = config.programId.toBase58();
  const authority = loadWalletKeypair(config.walletPath);
  const connection = new anchor.web3.Connection(config.rpcUrl, "confirmed");
  const wallet = new anchor.Wallet(authority);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);
  const program = new Program(idl, provider) as VotingProgram;
  return { program, authority };
}

export function bytesToArray32(bytes: Uint8Array): number[] {
  if (bytes.length !== 32) {
    throw new Error("expected 32 bytes");
  }
  return Array.from(bytes);
}

export function parseBytes32(input: string, label: string): Uint8Array {
  const trimmed = input.trim();
  try {
    const fromBase58 = new PublicKey(trimmed).toBytes();
    return fromBase58;
  } catch {
    const hex = trimmed.startsWith("0x") ? trimmed.slice(2) : trimmed;
    const buf = Buffer.from(hex, "hex");
    if (buf.length !== 32) {
      throw new Error(`${label}: expected 32 bytes (hex or base58)`);
    }
    return new Uint8Array(buf);
  }
}

export async function initializeRegistry(
  program: VotingProgram,
  authority: Keypair,
  merkleRoot: Uint8Array
): Promise<string> {
  const registry = voterRegistryPda(program.programId);
  const config = PublicKey.findProgramAddressSync(
    [Buffer.from("program_config")],
    program.programId
  )[0];

  return program.methods
    .initializeRegistry(bytesToArray32(merkleRoot))
    .accounts({
      authority: authority.publicKey,
      registry,
      config,
      systemProgram: SystemProgram.programId,
    })
    .signers([authority])
    .rpc();
}

export async function updateMerkleRoot(
  program: VotingProgram,
  authority: Keypair,
  merkleRoot: Uint8Array,
  listHash: Uint8Array
): Promise<string> {
  const registry = voterRegistryPda(program.programId);
  return program.methods
    .updateMerkleRoot(bytesToArray32(merkleRoot), bytesToArray32(listHash))
    .accounts({
      authority: authority.publicKey,
      registry,
    })
    .signers([authority])
    .rpc();
}

export async function grantEligibility(
  program: VotingProgram,
  authority: Keypair,
  voter: PublicKey
): Promise<string> {
  const registry = voterRegistryPda(program.programId);
  return program.methods
    .grantEligibility()
    .accounts({
      authority: authority.publicKey,
      registry,
      voter,
      granted: grantedVoterPda(program.programId, voter),
      systemProgram: SystemProgram.programId,
    })
    .signers([authority])
    .rpc();
}

export async function revokeEligibility(
  program: VotingProgram,
  authority: Keypair,
  voter: PublicKey
): Promise<string> {
  const registry = voterRegistryPda(program.programId);
  return program.methods
    .revokeEligibility()
    .accounts({
      authority: authority.publicKey,
      registry,
      voter,
      revoked: revokedVoterPda(program.programId, voter),
      systemProgram: SystemProgram.programId,
    })
    .signers([authority])
    .rpc();
}
