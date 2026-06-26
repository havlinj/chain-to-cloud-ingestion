import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { readFileSync } from "fs";
import { homedir } from "os";
import { join, resolve } from "path";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { bytesToArray32, programConfigPda, voterRegistryPda } from "voting-shared";

type ProgramConfigState = {
  activeProposal: PublicKey | null;
};

export type VotingProgram = Program & {
  account: {
    programConfig: {
      fetch: (address: PublicKey) => Promise<ProgramConfigState>;
    };
    proposal: {
      fetch: (address: PublicKey) => Promise<unknown>;
    };
  };
};

const DEFAULT_PROGRAM_ID = "BbnG5ScQxQrvZVq5FiDEgH7zx8dK6qH9jN3DEUmJSiuc";
const PACKAGE_ROOT = resolve(import.meta.dirname, "..");

export interface ChainConfig {
  rpcUrl: string;
  programId: PublicKey;
  walletPath: string;
  idlPath: string;
}

function chainConfigDefaults(): ChainConfig {
  return {
    rpcUrl: "https://api.devnet.solana.com",
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
  provider: anchor.AnchorProvider;
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
  return { program, authority, provider };
}

export async function initializeRegistryIfNeeded(
  program: VotingProgram,
  authority: Keypair,
  merkleRoot: Uint8Array
): Promise<boolean> {
  const registry = voterRegistryPda(program.programId);
  const config = programConfigPda(program.programId);
  const existing = await program.provider.connection.getAccountInfo(registry);
  if (existing) {
    return false;
  }
  await program.methods
    .initializeRegistry(bytesToArray32(merkleRoot))
    .accounts({
      authority: authority.publicKey,
      registry,
      config,
      systemProgram: SystemProgram.programId,
    })
    .signers([authority])
    .rpc();
  return true;
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

export async function closeActiveProposalIfAny(
  program: VotingProgram,
  authority: Keypair
): Promise<void> {
  const config = programConfigPda(program.programId);
  const cfg = await program.account.programConfig.fetch(config);
  if (cfg.activeProposal === null) {
    return;
  }
  const proposal = await program.account.proposal.fetch(cfg.activeProposal);
  const registry = voterRegistryPda(program.programId);
  try {
    await program.methods
      .closeProposal()
      .accounts({
        authority: authority.publicKey,
        registry,
        config,
        proposal: cfg.activeProposal,
      })
      .rpc();
  } catch {
    // Proposal may already be finalized or closed.
  }
  void proposal;
}
