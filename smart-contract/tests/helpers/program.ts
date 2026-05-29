import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

import { bytesToArray32, merkleLeaf, merkleRoot } from "./crypto";
import {
  commitmentPda,
  grantedVoterPda,
  programConfigPda,
  proposalPda,
  revokedVoterPda,
  voterRegistryPda,
} from "./pda";
import { setMerkleRoot } from "./setup";

type VotingProgram = Program;

export interface PhaseWindow {
  commitEndsAt: number;
  revealEndsAt: number;
}

export function phaseWindow(
  commitSecondsFromNow = 5,
  revealSecondsFromNow = 20
): PhaseWindow {
  const now = Math.floor(Date.now() / 1000);
  return {
    commitEndsAt: now + commitSecondsFromNow,
    revealEndsAt: now + revealSecondsFromNow,
  };
}

export async function createProposal(
  program: VotingProgram,
  authority: Keypair,
  proposalId: string,
  options: string[],
  window: PhaseWindow,
  title = "Test proposal"
): Promise<{ proposal: PublicKey; signature: string }> {
  const registry = voterRegistryPda(program.programId);
  const config = programConfigPda(program.programId);
  const proposal = proposalPda(program.programId, proposalId);

  const signature = await program.methods
    .createProposal(
      proposalId,
      title,
      options,
      new BN(window.commitEndsAt),
      new BN(window.revealEndsAt)
    )
    .accounts({
      authority: authority.publicKey,
      registry,
      config,
      proposal,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return { proposal, signature };
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

export async function transferAuthority(
  program: VotingProgram,
  authority: Keypair,
  newAuthority: PublicKey
): Promise<void> {
  const registry = voterRegistryPda(program.programId);
  await program.methods
    .transferAuthority(newAuthority)
    .accounts({
      authority: authority.publicKey,
      registry,
    })
    .signers([authority])
    .rpc();
}

export async function commitVote(
  program: VotingProgram,
  voter: Keypair,
  proposal: PublicKey,
  proposalId: string,
  commitment: Uint8Array,
  merkleProof: Uint8Array[],
  leafIndex: number,
  grantRevoke?: { granted?: PublicKey; revoked?: PublicKey }
): Promise<string> {
  const commitmentAccount = commitmentPda(
    program.programId,
    proposal,
    voter.publicKey
  );

  return program.methods
    .commitVote(
      bytesToArray32(commitment),
      merkleProof.map((p) => bytesToArray32(p)),
      leafIndex
    )
    .accounts({
      voter: voter.publicKey,
      proposal,
      commitmentAccount,
      grantedVoter: grantRevoke?.granted ?? null,
      revokedVoter: grantRevoke?.revoked ?? null,
      systemProgram: SystemProgram.programId,
    })
    .signers([voter])
    .rpc();
}

export async function revealVote(
  program: VotingProgram,
  voter: Keypair,
  proposal: PublicKey,
  optionId: string,
  salt: Uint8Array
): Promise<string> {
  const commitmentAccount = commitmentPda(
    program.programId,
    proposal,
    voter.publicKey
  );

  return program.methods
    .revealVote(optionId, bytesToArray32(salt))
    .accounts({
      voter: voter.publicKey,
      proposal,
      commitmentAccount,
    })
    .signers([voter])
    .rpc();
}

export async function rpcLogs(
  provider: anchor.AnchorProvider,
  signature: string
): Promise<string[]> {
  for (const commitment of ["confirmed", "finalized"] as const) {
    const tx = await provider.connection.getTransaction(signature, {
      commitment,
      maxSupportedTransactionVersion: 0,
    });
    const logs = tx?.meta?.logMessages;
    if (logs && logs.length > 0) {
      return logs;
    }
  }
  return [];
}

/** Simulation logs (local validators often omit logMessages in getTransaction). */
export async function simulateLogs(
  provider: anchor.AnchorProvider,
  tx: Transaction,
  signers: Keypair[] = []
): Promise<string[]> {
  const latest = await provider.connection.getLatestBlockhash();
  tx.feePayer = tx.feePayer ?? provider.wallet.publicKey;
  tx.recentBlockhash = latest.blockhash;
  if (signers.length > 0) {
    tx.partialSign(...signers);
  }
  const signed = await provider.wallet.signTransaction(tx);
  const sim = await provider.connection.simulateTransaction(signed);
  return sim.value.logs ?? [];
}

export async function setupMerkleElectorate(
  program: VotingProgram,
  authority: Keypair,
  pubkeys: PublicKey[]
): Promise<Uint8Array> {
  const sorted = [...pubkeys].sort((a, b) =>
    Buffer.compare(a.toBuffer(), b.toBuffer())
  );
  const leaves = sorted.map((pk) => merkleLeaf(pk.toBytes()));
  const root = merkleRoot(leaves);
  await setMerkleRoot(program, authority, root, new Uint8Array(32));
  return root;
}
