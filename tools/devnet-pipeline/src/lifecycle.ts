import { BN, Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  bytesToArray32,
  buildElectorateFromFile,
  commitmentPda,
  merkleProofForVoter,
  programConfigPda,
  proposalPda,
  voteCommitment,
  voterRegistryPda,
} from "voting-shared";
import { waitUntilUnix } from "./wait.js";
import {
  closeActiveProposalIfAny,
  initializeRegistryIfNeeded,
  loadVotingProgram,
  resolveChainConfig,
  updateMerkleRoot,
} from "./chain.js";

type VotingProgram = Program;

export interface BootstrapOptions {
  listPath: string;
}

export interface BootstrapResult {
  initialized: boolean;
  updateRootSignature: string | null;
  merkleRootHex: string;
  listHashHex: string;
}

export async function bootstrapRegistry(options: BootstrapOptions): Promise<BootstrapResult> {
  const electorate = buildElectorateFromFile(options.listPath);
  const config = resolveChainConfig();
  const { program, authority } = loadVotingProgram(config);

  const initialized = await initializeRegistryIfNeeded(
    program,
    authority,
    electorate.merkleRoot
  );

  const updateRootSignature = await updateMerkleRoot(
    program,
    authority,
    electorate.merkleRoot,
    electorate.listHash
  );

  return {
    initialized,
    updateRootSignature,
    merkleRootHex: Buffer.from(electorate.merkleRoot).toString("hex"),
    listHashHex: Buffer.from(electorate.listHash).toString("hex"),
  };
}

export interface LifecycleOptions {
  listPath: string;
  proposalId: string;
  title: string;
  options: string[];
  optionId: string;
  voterKeypair?: Keypair;
  commitSecondsFromNow: number;
  revealSecondsFromNow: number;
}

export interface LifecycleResult {
  proposalId: string;
  voterPubkey: string;
  createSignature: string;
  commitSignature: string;
  revealSignature: string;
  finalizeSignature: string;
  commitEndsAt: number;
  revealEndsAt: number;
}

export async function runVotingLifecycle(options: LifecycleOptions): Promise<LifecycleResult> {
  const electorate = buildElectorateFromFile(options.listPath);
  const config = resolveChainConfig();
  const { program, authority } = loadVotingProgram(config);

  await initializeRegistryIfNeeded(program, authority, electorate.merkleRoot);
  await updateMerkleRoot(program, authority, electorate.merkleRoot, electorate.listHash);
  await closeActiveProposalIfAny(program, authority);

  const voter = options.voterKeypair ?? authority;
  const proof = merkleProofForVoter(electorate, voter.publicKey.toBase58());

  const now = Math.floor(Date.now() / 1000);
  const commitEndsAt = now + options.commitSecondsFromNow;
  const revealEndsAt = now + options.revealSecondsFromNow;

  const registry = voterRegistryPda(program.programId);
  const programConfig = programConfigPda(program.programId);
  const proposal = proposalPda(program.programId, options.proposalId);

  const createSignature = await program.methods
    .createProposal(
      options.proposalId,
      options.title,
      options.options,
      new BN(commitEndsAt),
      new BN(revealEndsAt)
    )
    .accounts({
      authority: authority.publicKey,
      registry,
      config: programConfig,
      proposal,
      systemProgram: SystemProgram.programId,
    })
    .signers([authority])
    .rpc();

  const salt = Keypair.generate().secretKey.slice(0, 32);
  const commitment = voteCommitment(
    options.proposalId,
    salt,
    voter.publicKey.toBytes(),
    options.optionId
  );
  const commitmentAccount = commitmentPda(program.programId, proposal, voter.publicKey);

  const commitSignature = await program.methods
    .commitVote(
      bytesToArray32(commitment),
      proof.merkleProof.map((p) => bytesToArray32(p)),
      proof.leafIndex
    )
    .accounts({
      voter: voter.publicKey,
      proposal,
      commitmentAccount,
      grantedVoter: null,
      revokedVoter: null,
      systemProgram: SystemProgram.programId,
    })
    .signers([voter])
    .rpc();

  await waitUntilUnix(commitEndsAt, "reveal phase");

  const revealSignature = await program.methods
    .revealVote(options.optionId, bytesToArray32(salt))
    .accounts({
      voter: voter.publicKey,
      proposal,
      commitmentAccount,
    })
    .signers([voter])
    .rpc();

  await waitUntilUnix(revealEndsAt, "finalize");

  const finalizeSignature = await program.methods
    .finalizeProposal()
    .accounts({
      proposal,
      config: programConfig,
    })
    .rpc();

  return {
    proposalId: options.proposalId,
    voterPubkey: voter.publicKey.toBase58(),
    createSignature,
    commitSignature,
    revealSignature,
    finalizeSignature,
    commitEndsAt,
    revealEndsAt,
  };
}
