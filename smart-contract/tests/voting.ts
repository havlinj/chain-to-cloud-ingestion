import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import { expect } from "chai";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";

import {
  buildMerkleProof,
  bytesToArray32,
  hexToBytes32,
  merkleLeaf,
  merkleRoot,
  voteCommitment,
} from "./helpers/crypto";
import { loadCommitmentGolden, loadElectorateGolden } from "./helpers/fixtures";
import {
  commitmentPda,
  programConfigPda,
  proposalPda,
  voterRegistryPda,
} from "./helpers/pda";
import {
  closeActiveProposalIfAny,
  closeProposal,
  ensureRegistryInitialized,
  fundKeypair,
  requestHeapFrame,
  setMerkleRoot,
} from "./helpers/setup";
import { waitUntilUnix } from "./helpers/time";

type VotingProgram = Program;

const ZERO_HASH = new Uint8Array(32);

function sortedLeaves(pubkeys: PublicKey[]): Uint8Array[] {
  const sorted = [...pubkeys].sort((a, b) =>
    Buffer.compare(a.toBuffer(), b.toBuffer())
  );
  return sorted.map((pk) => merkleLeaf(pk.toBytes()));
}

function leafIndexFor(pubkeys: PublicKey[], voter: PublicKey): number {
  const sorted = [...pubkeys].sort((a, b) =>
    Buffer.compare(a.toBuffer(), b.toBuffer())
  );
  const idx = sorted.findIndex((pk) => pk.equals(voter));
  if (idx < 0) {
    throw new Error("voter not in electorate");
  }
  return idx;
}

describe("voting program", () => {
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

  it("matches ADR golden fixtures in TypeScript crypto helpers", () => {
    const electorate = loadElectorateGolden();
    const pubkeys = electorate.pubkeys_hex.map(hexToBytes32);
    const leaves = pubkeys.map(merkleLeaf);
    electorate.merkle_leaves_keccak256_hex.forEach((hex, i) => {
      expect(Buffer.from(leaves[i]).toString("hex")).to.equal(hex);
    });
    expect(Buffer.from(merkleRoot(leaves)).toString("hex")).to.equal(
      electorate.merkle_root_keccak256_hex
    );

    const golden = loadCommitmentGolden();
    const digest = voteCommitment(
      golden.proposal_id,
      hexToBytes32(golden.salt_hex),
      hexToBytes32(golden.voter_pubkey_hex),
      golden.option_id
    );
    expect(Buffer.from(digest).toString("hex")).to.equal(golden.sha256_hex);
  });

  it("commit → reveal → finalize with Merkle electorate", async () => {
    const voter1 = Keypair.generate();
    const voter2 = Keypair.generate();
    const electorate = [voter1.publicKey, voter2.publicKey];
    const leaves = sortedLeaves(electorate);
    const root = merkleRoot(leaves);
    const proof1 = buildMerkleProof(
      leaves,
      leafIndexFor(electorate, voter1.publicKey)
    );

    await setMerkleRoot(program, authority, root, ZERO_HASH);
    await fundKeypair(provider, voter1);

    const config = programConfigPda(program.programId);
    const proposalId = `prop-${Date.now()}`;
    const proposal = proposalPda(program.programId, proposalId);
    const registry = voterRegistryPda(program.programId);

    const now = Math.floor(Date.now() / 1000);
    const commitEndsAt = now + 3;
    const revealEndsAt = now + 12;

    await program.methods
      .createProposal(
        proposalId,
        "Golden path",
        ["1", "2"],
        new BN(commitEndsAt),
        new BN(revealEndsAt)
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
    const optionId = "1";
    const commitment = voteCommitment(
      proposalId,
      salt,
      voter1.publicKey.toBytes(),
      optionId
    );

    const commitmentAccount = commitmentPda(
      program.programId,
      proposal,
      voter1.publicKey
    );

    await program.methods
      .commitVote(
        bytesToArray32(commitment),
        proof1.map((p) => bytesToArray32(p)),
        leafIndexFor(electorate, voter1.publicKey)
      )
      .accounts({
        voter: voter1.publicKey,
        proposal,
        commitmentAccount,
        grantedVoter: null,
        revokedVoter: null,
        systemProgram: SystemProgram.programId,
      })
      .signers([voter1])
      .rpc();

    await waitUntilUnix(commitEndsAt);

    await program.methods
      .revealVote(optionId, bytesToArray32(salt))
      .accounts({
        voter: voter1.publicKey,
        proposal,
        commitmentAccount,
      })
      .signers([voter1])
      .rpc();

    const afterReveal = await program.account.proposal.fetch(proposal);
    expect(afterReveal.phase.reveal !== undefined).to.be.true;
    expect(afterReveal.optionCounts[0].toNumber()).to.equal(1);

    await waitUntilUnix(revealEndsAt);

    await program.methods
      .finalizeProposal()
      .accounts({
        proposal,
        config,
      })
      .rpc();

    const finalized = await program.account.proposal.fetch(proposal);
    expect(finalized.phase.finalized !== undefined).to.be.true;
  });

  it("rejects commit from voter not in frozen electorate", async () => {
    const voter = Keypair.generate();
    const outsider = Keypair.generate();
    const electorate = [voter.publicKey];
    const leaves = sortedLeaves(electorate);
    const root = merkleRoot(leaves);

    await setMerkleRoot(program, authority, root, ZERO_HASH);
    await fundKeypair(provider, outsider);

    const registry = voterRegistryPda(program.programId);
    const config = programConfigPda(program.programId);
    const proposalId = `prop-ineligible-${Date.now()}`;
    const proposal = proposalPda(program.programId, proposalId);

    const now = Math.floor(Date.now() / 1000);
    await program.methods
      .createProposal(
        proposalId,
        "Eligibility",
        ["yes", "no"],
        new BN(now + 60),
        new BN(now + 120)
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
    const commitment = voteCommitment(
      proposalId,
      salt,
      outsider.publicKey.toBytes(),
      "yes"
    );
    const commitmentAccount = commitmentPda(
      program.programId,
      proposal,
      outsider.publicKey
    );

    try {
      await program.methods
        .commitVote(bytesToArray32(commitment), [], 0)
        .accounts({
          voter: outsider.publicKey,
          proposal,
          commitmentAccount,
          grantedVoter: null,
          revokedVoter: null,
          systemProgram: SystemProgram.programId,
        })
        .signers([outsider])
        .rpc();
      expect.fail("expected NotEligible");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).to.match(/NotEligible|not eligible/i);
    } finally {
      await closeProposal(program, authority, proposalId);
    }
  });

  it("rejects invalid reveal (wrong salt)", async () => {
    const voter = Keypair.generate();
    const voter2 = Keypair.generate();
    const electorate = [voter.publicKey, voter2.publicKey];
    const leaves = sortedLeaves(electorate);
    const root = merkleRoot(leaves);
    const proof = buildMerkleProof(
      leaves,
      leafIndexFor(electorate, voter.publicKey)
    );

    await setMerkleRoot(program, authority, root, ZERO_HASH);
    await fundKeypair(provider, voter);

    const registry = voterRegistryPda(program.programId);
    const config = programConfigPda(program.programId);
    const proposalId = `prop-bad-reveal-${Date.now()}`;
    const proposal = proposalPda(program.programId, proposalId);

    const now = Math.floor(Date.now() / 1000);
    const commitEndsAt = now + 3;
    const revealEndsAt = now + 12;

    await program.methods
      .createProposal(
        proposalId,
        "Bad reveal",
        ["a", "b"],
        new BN(commitEndsAt),
        new BN(revealEndsAt)
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
    const commitment = voteCommitment(
      proposalId,
      salt,
      voter.publicKey.toBytes(),
      "a"
    );
    const commitmentAccount = commitmentPda(
      program.programId,
      proposal,
      voter.publicKey
    );

    await program.methods
      .commitVote(
        bytesToArray32(commitment),
        proof.map((p) => bytesToArray32(p)),
        leafIndexFor(electorate, voter.publicKey)
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

    await waitUntilUnix(commitEndsAt + 1);

    const wrongSalt = Keypair.generate().secretKey.slice(0, 32);
    try {
      await program.methods
        .revealVote("a", bytesToArray32(wrongSalt))
        .accounts({
          voter: voter.publicKey,
          proposal,
          commitmentAccount,
        })
        .signers([voter])
        .rpc();
      expect.fail("expected InvalidReveal");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).to.match(/InvalidReveal|invalid reveal/i);
    } finally {
      await closeProposal(program, authority, proposalId);
    }
  });

  it("rejects a second active proposal", async () => {
    const voter = Keypair.generate();
    const leaves = sortedLeaves([voter.publicKey]);
    const root = merkleRoot(leaves);
    await setMerkleRoot(program, authority, root, ZERO_HASH);

    const registry = voterRegistryPda(program.programId);
    const config = programConfigPda(program.programId);

    const now = Math.floor(Date.now() / 1000);
    const firstId = `prop-first-${Date.now()}`;
    const first = proposalPda(program.programId, firstId);

    await program.methods
      .createProposal(
        firstId,
        "First",
        ["1", "2"],
        new BN(now + 300),
        new BN(now + 600)
      )
      .accounts({
        authority: authority.publicKey,
        registry,
        config,
        proposal: first,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const secondId = `prop-second-${Date.now()}`;
    const second = proposalPda(program.programId, secondId);

    try {
      await program.methods
        .createProposal(
          secondId,
          "Second",
          ["1", "2"],
          new BN(now + 300),
          new BN(now + 600)
        )
        .accounts({
          authority: authority.publicKey,
          registry,
          config,
          proposal: second,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      expect.fail("expected ActiveProposalExists");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).to.match(/ActiveProposalExists|already active/i);
    } finally {
      await closeProposal(program, authority, firstId);
    }
  });
});
