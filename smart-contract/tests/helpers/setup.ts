import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  ComputeBudgetProgram,
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

import { bytesToArray32 } from "./crypto";
import { programConfigPda, proposalPda, voterRegistryPda } from "./pda";

type VotingProgram = Program;

export async function ensureRegistryInitialized(
  program: VotingProgram,
  authority: Keypair,
  initialRoot: Uint8Array
): Promise<void> {
  const registry = voterRegistryPda(program.programId);
  const config = programConfigPda(program.programId);
  const existing = await program.provider.connection.getAccountInfo(registry);
  if (existing) {
    return;
  }
  await program.methods
    .initializeRegistry(bytesToArray32(initialRoot))
    .accounts({
      authority: authority.publicKey,
      registry,
      config,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

export async function setMerkleRoot(
  program: VotingProgram,
  authority: Keypair,
  newRoot: Uint8Array,
  listHash: Uint8Array
): Promise<void> {
  const registry = voterRegistryPda(program.programId);
  await program.methods
    .updateMerkleRoot(bytesToArray32(newRoot), bytesToArray32(listHash))
    .accounts({
      authority: authority.publicKey,
      registry,
    })
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
  await closeProposal(program, authority, proposal.proposalId);
}

export async function closeProposal(
  program: VotingProgram,
  authority: Keypair,
  proposalId: string
): Promise<void> {
  const registry = voterRegistryPda(program.programId);
  const config = programConfigPda(program.programId);
  const proposal = proposalPda(program.programId, proposalId);
  try {
    await program.methods
      .closeProposal()
      .accounts({
        authority: authority.publicKey,
        registry,
        config,
        proposal,
      })
      .rpc();
  } catch {
    // Proposal may already be finalized or closed.
  }
}

/** Request larger BPF heap (default 32 KiB is too small for Anchor events + Vec fields). */
export async function requestHeapFrame(
  provider: anchor.AnchorProvider,
  bytes = 256 * 1024
): Promise<void> {
  const ix = ComputeBudgetProgram.requestHeapFrame({ bytes });
  const tx = new Transaction().add(ix);
  tx.feePayer = provider.wallet.publicKey;
  const sig = await provider.sendAndConfirm(tx, []);
  await provider.connection.confirmTransaction(sig, "confirmed");
}

export async function fundKeypair(
  provider: anchor.AnchorProvider,
  keypair: Keypair,
  sol = 2
): Promise<void> {
  const sig = await provider.connection.requestAirdrop(
    keypair.publicKey,
    sol * LAMPORTS_PER_SOL
  );
  const latest = await provider.connection.getLatestBlockhash();
  await provider.connection.confirmTransaction(
    { signature: sig, ...latest },
    "confirmed"
  );
}
