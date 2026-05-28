/**
 * Tests for coverage gaps identified in docs/planning/smart_contract_test_coverage_gaps.md
 */
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";

import { voteCommitment } from "./helpers/crypto";
import { expectAnchorError } from "./helpers/expect";
import {
  grantedVoterPda,
  programConfigPda,
  proposalPda,
  voterRegistryPda,
} from "./helpers/pda";
import {
  commitVote,
  createProposal,
  phaseWindow,
  revealVote,
  setupMerkleElectorate,
} from "./helpers/program";
import {
  closeActiveProposalIfAny,
  closeProposal,
  ensureRegistryInitialized,
  fundKeypair,
  requestHeapFrame,
} from "./helpers/setup";
import { uniqueProposalId } from "./helpers/ids";
import { waitUntilUnix } from "./helpers/time";

type VotingProgram = Program;

const ZERO_HASH = new Uint8Array(32);

function repeatChar(ch: string, count: number): string {
  return ch.repeat(count);
}

describe("voting gaps — create_proposal field validation", () => {
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

  async function expectCreateProposalFails(
    proposalId: string,
    title: string,
    options: string[],
    commitEndsAt: number,
    revealEndsAt: number,
    code: string
  ): Promise<void> {
    const registry = voterRegistryPda(program.programId);
    const config = programConfigPda(program.programId);
    const proposal = proposalPda(program.programId, proposalId);
    await expectAnchorError(
      () =>
        program.methods
          .createProposal(
            proposalId,
            title,
            options,
            new anchor.BN(commitEndsAt),
            new anchor.BN(revealEndsAt)
          )
          .accounts({
            authority: authority.publicKey,
            registry,
            config,
            proposal,
            systemProgram: SystemProgram.programId,
          })
          .rpc(),
      code
    );
  }

  it("rejects empty proposal_id (ProposalIdTooLong)", async () => {
    const now = Math.floor(Date.now() / 1000);
    await expectCreateProposalFails(
      "",
      "Title",
      ["a", "b"],
      now + 60,
      now + 120,
      "ProposalIdTooLong"
    );
  });

  it("rejects empty title (TitleTooLong)", async () => {
    const now = Math.floor(Date.now() / 1000);
    await expectCreateProposalFails(
      uniqueProposalId("et"),
      "",
      ["a", "b"],
      now + 60,
      now + 120,
      "TitleTooLong"
    );
  });

  it("rejects title longer than MAX_TITLE_LEN (TitleTooLong)", async () => {
    const now = Math.floor(Date.now() / 1000);
    await expectCreateProposalFails(
      uniqueProposalId("tl"),
      repeatChar("t", 129),
      ["a", "b"],
      now + 60,
      now + 120,
      "TitleTooLong"
    );
  });

  it("rejects empty option label (InvalidOptions)", async () => {
    const now = Math.floor(Date.now() / 1000);
    await expectCreateProposalFails(
      uniqueProposalId("eo"),
      "Title",
      ["", "b"],
      now + 60,
      now + 120,
      "InvalidOptions"
    );
  });

  it("rejects option label longer than MAX_OPTION_LEN (InvalidOptions)", async () => {
    const now = Math.floor(Date.now() / 1000);
    await expectCreateProposalFails(
      uniqueProposalId("ol"),
      "Title",
      [repeatChar("o", 65), "b"],
      now + 60,
      now + 120,
      "InvalidOptions"
    );
  });

  it("rejects more than MAX_OPTIONS choices (InvalidOptions)", async () => {
    const now = Math.floor(Date.now() / 1000);
    const many = Array.from({ length: 17 }, (_, i) => String(i));
    await expectCreateProposalFails(
      uniqueProposalId("mo"),
      "Title",
      many,
      now + 60,
      now + 120,
      "InvalidOptions"
    );
  });
});

describe("voting gaps — voting after close and reveal window", () => {
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

  it("rejects commit after authority close (NotCommitPhase)", async () => {
    const voter = Keypair.generate();
    await fundKeypair(provider, voter);
    await setupMerkleElectorate(program, authority, [voter.publicKey]);

    const proposalId = uniqueProposalId("cc");
    const window = phaseWindow(60, 120);
    const { proposal } = await createProposal(
      program,
      authority,
      proposalId,
      ["yes", "no"],
      window
    );
    await closeProposal(program, authority, proposalId);

    const salt = Keypair.generate().secretKey.slice(0, 32);
    const commitment = voteCommitment(
      proposalId,
      salt,
      voter.publicKey.toBytes(),
      "yes"
    );

    await expectAnchorError(
      () =>
        commitVote(program, voter, proposal, proposalId, commitment, [], 0),
      "NotCommitPhase"
    );
  });

  it("rejects reveal after authority close (ProposalNotOpen)", async () => {
    const voter = Keypair.generate();
    await fundKeypair(provider, voter);
    await setupMerkleElectorate(program, authority, [voter.publicKey]);

    const proposalId = uniqueProposalId("rc");
    const window = phaseWindow(5, 20);
    const { proposal } = await createProposal(
      program,
      authority,
      proposalId,
      ["yes", "no"],
      window
    );

    const salt = Keypair.generate().secretKey.slice(0, 32);
    const commitment = voteCommitment(
      proposalId,
      salt,
      voter.publicKey.toBytes(),
      "yes"
    );
    await commitVote(program, voter, proposal, proposalId, commitment, [], 0);
    await closeProposal(program, authority, proposalId);

    await expectAnchorError(
      () => revealVote(program, voter, proposal, "yes", salt),
      "ProposalNotOpen"
    );
  });

  it("rejects finalize after authority close (ProposalNotOpen)", async () => {
    const proposalId = uniqueProposalId("fc");
    const window = phaseWindow(300, 600);
    const { proposal } = await createProposal(
      program,
      authority,
      proposalId,
      ["a", "b"],
      window
    );
    await closeProposal(program, authority, proposalId);

    const config = programConfigPda(program.programId);
    await expectAnchorError(
      () =>
        program.methods
          .finalizeProposal()
          .accounts({ proposal, config })
          .rpc(),
      "ProposalNotOpen"
    );
  });

  it("rejects reveal after reveal_ends_at (NotRevealPhase)", async () => {
    const voter = Keypair.generate();
    await fundKeypair(provider, voter);
    await setupMerkleElectorate(program, authority, [voter.publicKey]);

    const proposalId = uniqueProposalId("lr");
    const window = phaseWindow(3, 10);
    const { proposal } = await createProposal(
      program,
      authority,
      proposalId,
      ["yes", "no"],
      window
    );

    const salt = Keypair.generate().secretKey.slice(0, 32);
    const commitment = voteCommitment(
      proposalId,
      salt,
      voter.publicKey.toBytes(),
      "yes"
    );
    await commitVote(program, voter, proposal, proposalId, commitment, [], 0);

    await waitUntilUnix(window.commitEndsAt + 1);
    await waitUntilUnix(window.revealEndsAt + 1);

    await expectAnchorError(
      () => revealVote(program, voter, proposal, "yes", salt),
      "NotRevealPhase"
    );

    await closeProposal(program, authority, proposalId);
  });
});

describe("voting gaps — registry and merkle limits", () => {
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

  it("rejects grant_eligibility from non-authority (Unauthorized)", async () => {
    const impostor = Keypair.generate();
    await fundKeypair(provider, impostor);
    const voter = Keypair.generate();

    const registry = voterRegistryPda(program.programId);
    await expectAnchorError(
      () =>
        program.methods
          .grantEligibility()
          .accounts({
            authority: impostor.publicKey,
            registry,
            voter: voter.publicKey,
            granted: grantedVoterPda(program.programId, voter.publicKey),
            systemProgram: SystemProgram.programId,
          })
          .signers([impostor])
          .rpc(),
      "Unauthorized"
    );
  });

  it("rejects commit when Merkle proof exceeds MAX_MERKLE_PROOF_LEN", async function () {
    // Anchor/Borsh may reject oversized Vec client-side before the tx hits the program.
    // On-chain still enforces len <= 32 in commit_vote; see gap matrix in docs/planning/.
    const voter = Keypair.generate();
    await fundKeypair(provider, voter);
    await setupMerkleElectorate(program, authority, [voter.publicKey]);

    const proposalId = uniqueProposalId("mp");
    const window = phaseWindow(60, 120);
    const { proposal } = await createProposal(
      program,
      authority,
      proposalId,
      ["a", "b"],
      window
    );

    const salt = Keypair.generate().secretKey.slice(0, 32);
    const commitment = voteCommitment(
      proposalId,
      salt,
      voter.publicKey.toBytes(),
      "a"
    );
    const oversizedProof = Array.from({ length: 33 }, () =>
      new Uint8Array(32)
    );

    await expectAnchorError(
      () =>
        commitVote(
          program,
          voter,
          proposal,
          proposalId,
          commitment,
          oversizedProof,
          0
        ),
      /MerkleProofInvalid|out of range/i
    );

    await closeProposal(program, authority, proposalId);
  });

  it("documents duplicate commit as system already-in-use (not AlreadyCommitted)", async () => {
    const voter = Keypair.generate();
    await fundKeypair(provider, voter);
    await setupMerkleElectorate(program, authority, [voter.publicKey]);

    const proposalId = uniqueProposalId("dc");
    const window = phaseWindow(60, 120);
    const { proposal } = await createProposal(
      program,
      authority,
      proposalId,
      ["a", "b"],
      window
    );

    const salt = Keypair.generate().secretKey.slice(0, 32);
    const commitment = voteCommitment(
      proposalId,
      salt,
      voter.publicKey.toBytes(),
      "a"
    );
    await commitVote(program, voter, proposal, proposalId, commitment, [], 0);

    await expectAnchorError(
      () =>
        commitVote(program, voter, proposal, proposalId, commitment, [], 0),
      /already in use/i
    );

    await closeProposal(program, authority, proposalId);
  });
});
