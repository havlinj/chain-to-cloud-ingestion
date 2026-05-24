/**
 * Extended on-chain coverage (priority gaps from coverage analysis).
 * Shared setup mirrors tests/voting.ts; run via scripts/run-all-tests.sh or anchor test.
 */
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { expect } from "chai";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";

import {
  buildMerkleProof,
  merkleLeaf,
  merkleRoot,
  voteCommitment,
} from "./helpers/crypto";
import { expectAnchorError, expectLogsInclude } from "./helpers/expect";
import {
  commitmentPda,
  grantedVoterPda,
  programConfigPda,
  proposalPda,
  revokedVoterPda,
  voterRegistryPda,
} from "./helpers/pda";
import {
  commitVote,
  createProposal,
  grantEligibility,
  phaseWindow,
  revealVote,
  revokeEligibility,
  simulateLogs,
  setupMerkleElectorate,
  transferAuthority,
} from "./helpers/program";
import {
  closeActiveProposalIfAny,
  closeProposal,
  ensureRegistryInitialized,
  fundKeypair,
  requestHeapFrame,
  setMerkleRoot,
} from "./helpers/setup";
import { uniqueProposalId } from "./helpers/ids";
import { waitUntilUnix } from "./helpers/time";

type VotingProgram = Program;

const ZERO_HASH = new Uint8Array(32);

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

describe("voting coverage — eligibility (grant / revoke / frozen root)", () => {
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

  it("rejects duplicate grant_eligibility (AlreadyGranted)", async () => {
    const voter = Keypair.generate();
    await grantEligibility(program, authority, voter.publicKey);
    await expectAnchorError(
      () => grantEligibility(program, authority, voter.publicKey),
      /AlreadyGranted|already in use/i
    );
  });

  it("rejects duplicate revoke_eligibility (AlreadyRevoked)", async () => {
    const voter = Keypair.generate();
    await revokeEligibility(program, authority, voter.publicKey);
    await expectAnchorError(
      () => revokeEligibility(program, authority, voter.publicKey),
      /AlreadyRevoked|already in use/i
    );
  });

  it("commits with single-leaf electorate and empty Merkle proof", async () => {
    const voter = Keypair.generate();
    await fundKeypair(provider, voter);
    await setupMerkleElectorate(program, authority, [voter.publicKey]);

    const proposalId = uniqueProposalId("sl");
    const window = phaseWindow(5, 20);
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

    await commitVote(
      program,
      voter,
      proposal,
      proposalId,
      commitment,
      [],
      0
    );

    await closeProposal(program, authority, proposalId);
  });

  it("commits via grant PDA when voter is not in the Merkle tree", async () => {
    const voter = Keypair.generate();
    await fundKeypair(provider, voter);
    await grantEligibility(program, authority, voter.publicKey);

    const proposalId = uniqueProposalId("g");
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

    await commitVote(
      program,
      voter,
      proposal,
      proposalId,
      commitment,
      [],
      0,
      { granted: grantedVoterPda(program.programId, voter.publicKey) }
    );

    await closeProposal(program, authority, proposalId);
  });

  it("allows commit when grant was before snapshot and revoke after snapshot", async () => {
    const voter = Keypair.generate();
    await fundKeypair(provider, voter);
    await grantEligibility(program, authority, voter.publicKey);

    const proposalId = uniqueProposalId("gra");
    const window = phaseWindow(5, 20);
    const { proposal } = await createProposal(
      program,
      authority,
      proposalId,
      ["a", "b"],
      window
    );

    await revokeEligibility(program, authority, voter.publicKey);

    const salt = Keypair.generate().secretKey.slice(0, 32);
    const commitment = voteCommitment(
      proposalId,
      salt,
      voter.publicKey.toBytes(),
      "a"
    );

    await commitVote(
      program,
      voter,
      proposal,
      proposalId,
      commitment,
      [],
      0,
      {
        granted: grantedVoterPda(program.programId, voter.publicKey),
        revoked: revokedVoterPda(program.programId, voter.publicKey),
      }
    );

    await closeProposal(program, authority, proposalId);
  });

  it("rejects commit when grant and revoke both occurred before snapshot", async () => {
    const voter = Keypair.generate();
    await fundKeypair(provider, voter);
    await grantEligibility(program, authority, voter.publicKey);
    await revokeEligibility(program, authority, voter.publicKey);

    const proposalId = uniqueProposalId("grb");
    const window = phaseWindow(60, 120);
    const { proposal } = await createProposal(
      program,
      authority,
      proposalId,
      ["x", "y"],
      window
    );

    const salt = Keypair.generate().secretKey.slice(0, 32);
    const commitment = voteCommitment(
      proposalId,
      salt,
      voter.publicKey.toBytes(),
      "x"
    );

    await expectAnchorError(
      () =>
        commitVote(
          program,
          voter,
          proposal,
          proposalId,
          commitment,
          [],
          0,
          {
            granted: grantedVoterPda(program.programId, voter.publicKey),
            revoked: revokedVoterPda(program.programId, voter.publicKey),
          }
        ),
      "NotEligible"
    );

    await closeProposal(program, authority, proposalId);
  });

  it("commits against frozen electorate root after living registry root changes", async () => {
    const voter = Keypair.generate();
    const other = Keypair.generate();
    await fundKeypair(provider, voter);

    await setupMerkleElectorate(program, authority, [voter.publicKey, other.publicKey]);
    const leaves = [voter.publicKey, other.publicKey]
      .sort((a, b) => Buffer.compare(a.toBuffer(), b.toBuffer()))
      .map((pk) => merkleLeaf(pk.toBytes()));
    const frozenRoot = merkleRoot(leaves);
    const proof = buildMerkleProof(leaves, leafIndexFor([voter.publicKey, other.publicKey], voter.publicKey));

    const proposalId = uniqueProposalId("fz");
    const window = phaseWindow(5, 20);
    const { proposal } = await createProposal(
      program,
      authority,
      proposalId,
      ["1", "2"],
      window
    );

    const prop = await program.account.proposal.fetch(proposal);
    expect(Buffer.from(prop.electorateMerkleRoot)).to.deep.equal(
      Buffer.from(frozenRoot)
    );

    const outsider = Keypair.generate();
    await setupMerkleElectorate(program, authority, [outsider.publicKey]);

    const salt = Keypair.generate().secretKey.slice(0, 32);
    const commitment = voteCommitment(
      proposalId,
      salt,
      voter.publicKey.toBytes(),
      "1"
    );

    await commitVote(
      program,
      voter,
      proposal,
      proposalId,
      commitment,
      proof,
      leafIndexFor([voter.publicKey, other.publicKey], voter.publicKey)
    );

    await closeProposal(program, authority, proposalId);
  });

  it("rejects commit with invalid Merkle proof (MerkleProofInvalid)", async () => {
    const voter = Keypair.generate();
    const other = Keypair.generate();
    await fundKeypair(provider, voter);
    await setupMerkleElectorate(program, authority, [voter.publicKey, other.publicKey]);

    const leaves = [voter.publicKey, other.publicKey]
      .sort((a, b) => Buffer.compare(a.toBuffer(), b.toBuffer()))
      .map((pk) => merkleLeaf(pk.toBytes()));
    const proof = buildMerkleProof(leaves, 0);
    const badProof = [...proof];
    if (badProof.length > 0) {
      badProof[0] = new Uint8Array(32);
      badProof[0][0] ^= 0xff;
    }

    const proposalId = uniqueProposalId("bp");
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

    await expectAnchorError(
      () =>
        commitVote(
          program,
          voter,
          proposal,
          proposalId,
          commitment,
          badProof,
          leafIndexFor([voter.publicKey, other.publicKey], voter.publicKey)
        ),
      "MerkleProofInvalid"
    );

    await closeProposal(program, authority, proposalId);
  });
});

describe("voting coverage — phase deadlines and idempotency", () => {
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

  async function merkleSetup(voter: Keypair): Promise<{
    proposal: PublicKey;
    proposalId: string;
    proof: Uint8Array[];
    leafIndex: number;
    window: ReturnType<typeof phaseWindow>;
  }> {
    await setupMerkleElectorate(program, authority, [voter.publicKey]);
    const proposalId = uniqueProposalId("ph");
    const window = phaseWindow(3, 15);
    const { proposal } = await createProposal(
      program,
      authority,
      proposalId,
      ["yes", "no"],
      window
    );
    return {
      proposal,
      proposalId,
      proof: [],
      leafIndex: 0,
      window,
    };
  }

  it("rejects commit after commit_ends_at", async () => {
    const voter = Keypair.generate();
    await fundKeypair(provider, voter);
    const { proposal, proposalId, window } = await merkleSetup(voter);

    await waitUntilUnix(window.commitEndsAt + 1);

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

    await closeProposal(program, authority, proposalId);
  });

  it("rejects reveal before commit_ends_at", async () => {
    const voter = Keypair.generate();
    await fundKeypair(provider, voter);
    const { proposal, proposalId, proof, leafIndex, window } =
      await merkleSetup(voter);

    const salt = Keypair.generate().secretKey.slice(0, 32);
    const commitment = voteCommitment(
      proposalId,
      salt,
      voter.publicKey.toBytes(),
      "yes"
    );
    await commitVote(
      program,
      voter,
      proposal,
      proposalId,
      commitment,
      proof,
      leafIndex
    );

    await expectAnchorError(
      () => revealVote(program, voter, proposal, "yes", salt),
      "NotRevealPhase"
    );

    await closeProposal(program, authority, proposalId);
  });

  it("rejects finalize before reveal_ends_at", async () => {
    const voter = Keypair.generate();
    await fundKeypair(provider, voter);
    const { proposal, proposalId, proof, leafIndex, window } =
      await merkleSetup(voter);

    const salt = Keypair.generate().secretKey.slice(0, 32);
    const commitment = voteCommitment(
      proposalId,
      salt,
      voter.publicKey.toBytes(),
      "yes"
    );
    await commitVote(
      program,
      voter,
      proposal,
      proposalId,
      commitment,
      proof,
      leafIndex
    );

    await waitUntilUnix(window.commitEndsAt + 1);
    await revealVote(program, voter, proposal, "yes", salt);

    const config = programConfigPda(program.programId);
    await expectAnchorError(
      () =>
        program.methods
          .finalizeProposal()
          .accounts({ proposal, config })
          .rpc(),
      "RevealNotEnded"
    );

    await closeProposal(program, authority, proposalId);
  });

  it("rejects duplicate commit from the same voter", async () => {
    const voter = Keypair.generate();
    await fundKeypair(provider, voter);
    const { proposal, proposalId, proof, leafIndex } = await merkleSetup(voter);

    const salt = Keypair.generate().secretKey.slice(0, 32);
    const commitment = voteCommitment(
      proposalId,
      salt,
      voter.publicKey.toBytes(),
      "yes"
    );
    await commitVote(
      program,
      voter,
      proposal,
      proposalId,
      commitment,
      proof,
      leafIndex
    );

    await expectAnchorError(
      () =>
        commitVote(
          program,
          voter,
          proposal,
          proposalId,
          commitment,
          proof,
          leafIndex
        ),
      /already in use|AlreadyCommitted|custom program error/i
    );

    await closeProposal(program, authority, proposalId);
  });

  it("rejects second reveal (AlreadyRevealed)", async () => {
    const voter = Keypair.generate();
    await fundKeypair(provider, voter);
    const { proposal, proposalId, proof, leafIndex, window } =
      await merkleSetup(voter);

    const salt = Keypair.generate().secretKey.slice(0, 32);
    const commitment = voteCommitment(
      proposalId,
      salt,
      voter.publicKey.toBytes(),
      "yes"
    );
    await commitVote(
      program,
      voter,
      proposal,
      proposalId,
      commitment,
      proof,
      leafIndex
    );

    await waitUntilUnix(window.commitEndsAt + 1);
    await revealVote(program, voter, proposal, "yes", salt);

    await expectAnchorError(
      () => revealVote(program, voter, proposal, "yes", salt),
      "AlreadyRevealed"
    );

    await closeProposal(program, authority, proposalId);
  });

  it("rejects reveal with unknown option_id", async () => {
    const voter = Keypair.generate();
    await fundKeypair(provider, voter);
    const { proposal, proposalId, proof, leafIndex, window } =
      await merkleSetup(voter);

    const unknownOption = "invalid-option";
    const salt = Keypair.generate().secretKey.slice(0, 32);
    const commitment = voteCommitment(
      proposalId,
      salt,
      voter.publicKey.toBytes(),
      unknownOption
    );
    await commitVote(
      program,
      voter,
      proposal,
      proposalId,
      commitment,
      proof,
      leafIndex
    );

    await waitUntilUnix(window.commitEndsAt + 1);

    await expectAnchorError(
      () => revealVote(program, voter, proposal, unknownOption, salt),
      "UnknownOptionId"
    );

    await closeProposal(program, authority, proposalId);
  });

  it("authority close_proposal sets phase to closed", async () => {
    const proposalId = uniqueProposalId("cl");
    const window = phaseWindow(300, 600);
    const { proposal } = await createProposal(
      program,
      authority,
      proposalId,
      ["a", "b"],
      window
    );

    const registry = voterRegistryPda(program.programId);
    const config = programConfigPda(program.programId);
    await program.methods
      .closeProposal()
      .accounts({
        authority: authority.publicKey,
        registry,
        config,
        proposal,
      })
      .rpc();

    const acc = await program.account.proposal.fetch(proposal);
    expect(acc.phase.closed !== undefined).to.be.true;

    const cfg = await program.account.programConfig.fetch(config);
    expect(cfg.activeProposal).to.be.null;
  });
});

describe("voting coverage — registry admin and create_proposal validation", () => {
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

  it("transfer_authority moves registry control to the new authority", async () => {
    const newAuth = Keypair.generate();
    await fundKeypair(provider, newAuth);

    try {
      await transferAuthority(program, authority, newAuth.publicKey);

      const registry = voterRegistryPda(program.programId);
      const reg = await program.account.voterRegistry.fetch(registry);
      expect(reg.authority.equals(newAuth.publicKey)).to.be.true;

      const root = merkleRoot([merkleLeaf(newAuth.publicKey.toBytes())]);
      await expectAnchorError(
        () => setMerkleRoot(program, authority, root, ZERO_HASH),
        "Unauthorized"
      );

      await setMerkleRoot(program, newAuth, root, ZERO_HASH);
    } finally {
      await transferAuthority(program, newAuth, authority.publicKey);
    }
  });

  it("rejects create_proposal with commit_ends_at in the past", async () => {
    const registry = voterRegistryPda(program.programId);
    const config = programConfigPda(program.programId);
    const proposalId = uniqueProposalId("pc");
    const proposal = proposalPda(program.programId, proposalId);
    const now = Math.floor(Date.now() / 1000);

    await expectAnchorError(
      () =>
        program.methods
          .createProposal(
            proposalId,
            "Title",
            ["a", "b"],
            new anchor.BN(now - 60),
            new anchor.BN(now + 3600)
          )
          .accounts({
            authority: authority.publicKey,
            registry,
            config,
            proposal,
            systemProgram: SystemProgram.programId,
          })
          .rpc(),
      "CommitEndsInPast"
    );
  });

  it("rejects create_proposal when reveal_ends_at is before commit_ends_at", async () => {
    const registry = voterRegistryPda(program.programId);
    const config = programConfigPda(program.programId);
    const proposalId = uniqueProposalId("bw");
    const proposal = proposalPda(program.programId, proposalId);
    const now = Math.floor(Date.now() / 1000);

    await expectAnchorError(
      () =>
        program.methods
          .createProposal(
            proposalId,
            "Title",
            ["a", "b"],
            new anchor.BN(now + 120),
            new anchor.BN(now + 60)
          )
          .accounts({
            authority: authority.publicKey,
            registry,
            config,
            proposal,
            systemProgram: SystemProgram.programId,
          })
          .rpc(),
      "RevealBeforeCommitEnd"
    );
  });

  it("rejects create_proposal with fewer than two options", async () => {
    const registry = voterRegistryPda(program.programId);
    const config = programConfigPda(program.programId);
    const proposalId = uniqueProposalId("oo");
    const proposal = proposalPda(program.programId, proposalId);
    const now = Math.floor(Date.now() / 1000);

    await expectAnchorError(
      () =>
        program.methods
          .createProposal(
            proposalId,
            "Title",
            ["only"],
            new anchor.BN(now + 60),
            new anchor.BN(now + 120)
          )
          .accounts({
            authority: authority.publicKey,
            registry,
            config,
            proposal,
            systemProgram: SystemProgram.programId,
          })
          .rpc(),
      "InvalidOptions"
    );
  });
});

describe("voting coverage — tally and instruction logs", () => {
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

  it("increments option_counts for two voters revealing the same option", async () => {
    const voter1 = Keypair.generate();
    const voter2 = Keypair.generate();
    await fundKeypair(provider, voter1);
    await fundKeypair(provider, voter2);

    const electorate = [voter1.publicKey, voter2.publicKey];
    await setupMerkleElectorate(program, authority, electorate);
    const leaves = electorate
      .sort((a, b) => Buffer.compare(a.toBuffer(), b.toBuffer()))
      .map((pk) => merkleLeaf(pk.toBytes()));

    const proposalId = uniqueProposalId("tl");
    const window = phaseWindow(3, 15);
    const { proposal } = await createProposal(
      program,
      authority,
      proposalId,
      ["alpha", "beta"],
      window
    );

    const reveals: { voter: Keypair; salt: Uint8Array }[] = [];
    for (const voter of [voter1, voter2]) {
      const salt = Keypair.generate().secretKey.slice(0, 32);
      const commitment = voteCommitment(
        proposalId,
        salt,
        voter.publicKey.toBytes(),
        "alpha"
      );
      const proof = buildMerkleProof(
        leaves,
        leafIndexFor(electorate, voter.publicKey)
      );
      await commitVote(
        program,
        voter,
        proposal,
        proposalId,
        commitment,
        proof,
        leafIndexFor(electorate, voter.publicKey)
      );
      reveals.push({ voter, salt });
    }

    await waitUntilUnix(window.commitEndsAt + 1);
    for (const { voter, salt } of reveals) {
      await revealVote(program, voter, proposal, "alpha", salt);
    }

    const acc = await program.account.proposal.fetch(proposal);
    expect(acc.optionCounts[0].toNumber()).to.equal(2);
    expect(acc.optionCounts[1].toNumber()).to.equal(0);

    await closeProposal(program, authority, proposalId);
  });

  it("emits instruction logs for create, commit, and reveal", async () => {
    const voter = Keypair.generate();
    await fundKeypair(provider, voter);
    const padding = Keypair.generate().publicKey;
    const electorate = [voter.publicKey, padding].sort((a, b) =>
      Buffer.compare(a.toBuffer(), b.toBuffer())
    );
    await setupMerkleElectorate(program, authority, electorate);
    const leaves = electorate.map((pk) => merkleLeaf(pk.toBytes()));
    const leafIndex = leafIndexFor(electorate, voter.publicKey);
    const proof = buildMerkleProof(leaves, leafIndex);

    const proposalId = uniqueProposalId("lg");
    const window = phaseWindow(3, 15);
    const registry = voterRegistryPda(program.programId);
    const config = programConfigPda(program.programId);
    const proposal = proposalPda(program.programId, proposalId);

    const createTx = await program.methods
      .createProposal(
        proposalId,
        "Logs",
        ["1", "2"],
        new anchor.BN(window.commitEndsAt),
        new anchor.BN(window.revealEndsAt)
      )
      .accounts({
        authority: authority.publicKey,
        registry,
        config,
        proposal,
        systemProgram: SystemProgram.programId,
      })
      .transaction();

    const createLogs = await simulateLogs(provider, createTx);
    expectLogsInclude(createLogs, "CreateProposal");

    await provider.sendAndConfirm(createTx);

    const salt = Keypair.generate().secretKey.slice(0, 32);
    const commitment = voteCommitment(
      proposalId,
      salt,
      voter.publicKey.toBytes(),
      "1"
    );
    const commitTx = await program.methods
      .commitVote(
        Array.from(commitment),
        proof.map((p) => Array.from(p)),
        leafIndex
      )
      .accounts({
        voter: voter.publicKey,
        proposal,
        commitmentAccount: commitmentPda(
          program.programId,
          proposal,
          voter.publicKey
        ),
        grantedVoter: null,
        revokedVoter: null,
        systemProgram: SystemProgram.programId,
      })
      .signers([voter])
      .transaction();

    const commitLogs = await simulateLogs(provider, commitTx, [voter]);
    expectLogsInclude(commitLogs, "CommitVote");
    await provider.sendAndConfirm(commitTx, [voter]);

    await waitUntilUnix(window.commitEndsAt + 1);

    const revealTx = await program.methods
      .revealVote("1", Array.from(salt))
      .accounts({
        voter: voter.publicKey,
        proposal,
        commitmentAccount: commitmentPda(
          program.programId,
          proposal,
          voter.publicKey
        ),
      })
      .signers([voter])
      .transaction();

    const revealLogs = await simulateLogs(provider, revealTx, [voter]);
    expectLogsInclude(revealLogs, "RevealVote");
    await provider.sendAndConfirm(revealTx, [voter]);

    await closeProposal(program, authority, proposalId);
  });
});
