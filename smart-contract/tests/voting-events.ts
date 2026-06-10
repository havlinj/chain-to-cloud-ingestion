/**
 * Decoded Anchor event payloads (one happy-path test per emitted event type).
 */
import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import { expect } from "chai";
import { Keypair, SystemProgram } from "@solana/web3.js";

import { bytesToArray32, merkleLeaf, merkleRoot, voteCommitment } from "./helpers/crypto";
import { decodeEventsFromSimulation, expectEventNamed, expectPubkeyField } from "./helpers/events";
import {
  commitmentPda,
  grantedVoterPda,
  programConfigPda,
  proposalPda,
  revokedVoterPda,
  voterRegistryPda,
} from "./helpers/pda";
import {
  closeActiveProposalIfAny,
  closeProposal,
  ensureRegistryInitialized,
  fundKeypair,
  requestHeapFrame,
} from "./helpers/setup";
import { phaseWindow, setupMerkleElectorate } from "./helpers/program";
import { uniqueProposalId } from "./helpers/ids";
import { waitUntilUnix } from "./helpers/time";

type VotingProgram = Program;

const ZERO_HASH = new Uint8Array(32);

describe("voting program — Anchor event payloads", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Voting as VotingProgram;
  const authority = (provider.wallet as anchor.Wallet).payer;

  before(async () => {
    await requestHeapFrame(provider);
    await ensureRegistryInitialized(program, authority, ZERO_HASH);
  });

  beforeEach(async () => {
    await closeActiveProposalIfAny(program, authority);
  });

  it("emits ProposalCreated with expected fields", async () => {
    const proposalId = uniqueProposalId("pc");
    const window = phaseWindow(60, 120);
    const registry = voterRegistryPda(program.programId);
    const config = programConfigPda(program.programId);
    const proposal = proposalPda(program.programId, proposalId);

    const tx = await program.methods
      .createProposal(
        proposalId,
        "Event test",
        ["yes", "no"],
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
      .transaction();

    const events = await decodeEventsFromSimulation(provider, program, tx);
    const evt = expectEventNamed(events, "proposalCreated");
    expect(evt.data.proposalId).to.equal(proposalId);
    expect(evt.data.title).to.equal("Event test");
    expect(evt.data.phase).to.equal("commit");

    await provider.sendAndConfirm(tx);

    await closeProposal(program, authority, proposalId);
  });

  it("emits VoteCommitted with commitment and voter", async () => {
    const voter = Keypair.generate();
    await fundKeypair(provider, voter);
    await setupMerkleElectorate(program, authority, [voter.publicKey]);

    const proposalId = uniqueProposalId("vc");
    const window = phaseWindow(60, 120);
    const registry = voterRegistryPda(program.programId);
    const config = programConfigPda(program.programId);
    const proposal = proposalPda(program.programId, proposalId);

    await program.methods
      .createProposal(
        proposalId,
        "T",
        ["a", "b"],
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

    const salt = Keypair.generate().secretKey.slice(0, 32);
    const commitment = voteCommitment(proposalId, salt, voter.publicKey.toBytes(), "a");

    const tx = await program.methods
      .commitVote(bytesToArray32(commitment), [], 0)
      .accounts({
        voter: voter.publicKey,
        proposal,
        commitmentAccount: commitmentPda(program.programId, proposal, voter.publicKey),
        grantedVoter: null,
        revokedVoter: null,
        systemProgram: SystemProgram.programId,
      })
      .signers([voter])
      .transaction();

    const events = await decodeEventsFromSimulation(provider, program, tx, [voter]);
    const evt = expectEventNamed(events, "voteCommitted");
    expect(evt.data.proposalId).to.equal(proposalId);
    expectPubkeyField(evt.data, "voterPubkey", voter.publicKey);

    await provider.sendAndConfirm(tx, [voter]);
    await closeProposal(program, authority, proposalId);
  });

  it("emits VoteRevealed with option_id", async () => {
    const voter = Keypair.generate();
    await fundKeypair(provider, voter);
    await setupMerkleElectorate(program, authority, [voter.publicKey]);

    const proposalId = uniqueProposalId("vr");
    const window = phaseWindow(3, 12);
    const registry = voterRegistryPda(program.programId);
    const config = programConfigPda(program.programId);
    const proposal = proposalPda(program.programId, proposalId);

    await program.methods
      .createProposal(
        proposalId,
        "T",
        ["yes", "no"],
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

    const salt = Keypair.generate().secretKey.slice(0, 32);
    const commitment = voteCommitment(proposalId, salt, voter.publicKey.toBytes(), "yes");
    await program.methods
      .commitVote(bytesToArray32(commitment), [], 0)
      .accounts({
        voter: voter.publicKey,
        proposal,
        commitmentAccount: commitmentPda(program.programId, proposal, voter.publicKey),
        grantedVoter: null,
        revokedVoter: null,
        systemProgram: SystemProgram.programId,
      })
      .signers([voter])
      .rpc();

    await waitUntilUnix(window.commitEndsAt + 1);

    const tx = await program.methods
      .revealVote("yes", bytesToArray32(salt))
      .accounts({
        voter: voter.publicKey,
        proposal,
        commitmentAccount: commitmentPda(program.programId, proposal, voter.publicKey),
      })
      .signers([voter])
      .transaction();

    const events = await decodeEventsFromSimulation(provider, program, tx, [voter]);
    const evt = expectEventNamed(events, "voteRevealed");
    expect(evt.data.proposalId).to.equal(proposalId);
    expect(evt.data.optionId).to.equal("yes");

    await provider.sendAndConfirm(tx, [voter]);
    await closeProposal(program, authority, proposalId);
  });

  it("emits ProposalClosed", async () => {
    const proposalId = uniqueProposalId("cl");
    const window = phaseWindow(300, 600);
    const registry = voterRegistryPda(program.programId);
    const config = programConfigPda(program.programId);
    const proposal = proposalPda(program.programId, proposalId);

    await program.methods
      .createProposal(
        proposalId,
        "T",
        ["a", "b"],
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

    const tx = await program.methods
      .closeProposal()
      .accounts({
        authority: authority.publicKey,
        registry,
        config,
        proposal,
      })
      .transaction();

    const events = await decodeEventsFromSimulation(provider, program, tx);
    const evt = expectEventNamed(events, "proposalClosed");
    expect(evt.data.proposalId).to.equal(proposalId);

    await provider.sendAndConfirm(tx);
  });

  it("emits ProposalFinalized", async () => {
    const voter = Keypair.generate();
    await fundKeypair(provider, voter);
    await setupMerkleElectorate(program, authority, [voter.publicKey]);

    const proposalId = uniqueProposalId("fn");
    const window = phaseWindow(3, 10);
    const registry = voterRegistryPda(program.programId);
    const config = programConfigPda(program.programId);
    const proposal = proposalPda(program.programId, proposalId);

    await program.methods
      .createProposal(
        proposalId,
        "T",
        ["1", "2"],
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

    const salt = Keypair.generate().secretKey.slice(0, 32);
    const commitment = voteCommitment(proposalId, salt, voter.publicKey.toBytes(), "1");
    await program.methods
      .commitVote(bytesToArray32(commitment), [], 0)
      .accounts({
        voter: voter.publicKey,
        proposal,
        commitmentAccount: commitmentPda(program.programId, proposal, voter.publicKey),
        grantedVoter: null,
        revokedVoter: null,
        systemProgram: SystemProgram.programId,
      })
      .signers([voter])
      .rpc();

    await waitUntilUnix(window.commitEndsAt + 1);
    await program.methods
      .revealVote("1", bytesToArray32(salt))
      .accounts({
        voter: voter.publicKey,
        proposal,
        commitmentAccount: commitmentPda(program.programId, proposal, voter.publicKey),
      })
      .signers([voter])
      .rpc();

    await waitUntilUnix(window.revealEndsAt + 1);

    const tx = await program.methods
      .finalizeProposal()
      .accounts({ proposal, config })
      .transaction();

    const events = await decodeEventsFromSimulation(provider, program, tx);
    const evt = expectEventNamed(events, "proposalFinalized");
    expect(evt.data.proposalId).to.equal(proposalId);

    await provider.sendAndConfirm(tx);
  });

  it("emits EligibleVotersRootUpdated", async () => {
    const root = merkleRoot([merkleLeaf(authority.publicKey.toBytes())]);
    const listHash = new Uint8Array(32);
    listHash[0] = 0xab;

    const registry = voterRegistryPda(program.programId);
    const tx = await program.methods
      .updateMerkleRoot(bytesToArray32(root), bytesToArray32(listHash))
      .accounts({
        authority: authority.publicKey,
        registry,
      })
      .transaction();

    const events = await decodeEventsFromSimulation(provider, program, tx);
    const evt = expectEventNamed(events, "eligibleVotersRootUpdated");
    expect(evt.data.merkleRoot).to.satisfy(
      (v: unknown) => v instanceof Uint8Array || Array.isArray(v)
    );
    expect(evt.data.listHash).to.satisfy(
      (v: unknown) => v instanceof Uint8Array || Array.isArray(v)
    );

    await provider.sendAndConfirm(tx);
  });

  it("emits VoterEligibilityGranted", async () => {
    const voter = Keypair.generate();
    const registry = voterRegistryPda(program.programId);
    const tx = await program.methods
      .grantEligibility()
      .accounts({
        authority: authority.publicKey,
        registry,
        voter: voter.publicKey,
        granted: grantedVoterPda(program.programId, voter.publicKey),
        systemProgram: SystemProgram.programId,
      })
      .transaction();

    const events = await decodeEventsFromSimulation(provider, program, tx);
    const evt = expectEventNamed(events, "voterEligibilityGranted");
    expectPubkeyField(evt.data, "voterPubkey", voter.publicKey);

    await provider.sendAndConfirm(tx);
  });

  it("emits VoterEligibilityRevoked", async () => {
    const voter = Keypair.generate();
    const registry = voterRegistryPda(program.programId);
    const tx = await program.methods
      .revokeEligibility()
      .accounts({
        authority: authority.publicKey,
        registry,
        voter: voter.publicKey,
        revoked: revokedVoterPda(program.programId, voter.publicKey),
        systemProgram: SystemProgram.programId,
      })
      .transaction();

    const events = await decodeEventsFromSimulation(provider, program, tx);
    const evt = expectEventNamed(events, "voterEligibilityRevoked");
    expectPubkeyField(evt.data, "voterPubkey", voter.publicKey);

    await provider.sendAndConfirm(tx);
  });
});
