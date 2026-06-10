use anchor_lang::prelude::*;
use voting_crypto::vote_commitment;

use crate::constants::MAX_MERKLE_PROOF_LEN;
use crate::eligibility::require_eligible;
use crate::errors::VotingError;
use crate::events::{VoteCommitted, VoteRevealed};
use crate::state::{CommitVote, ProposalPhase, RevealVote};

pub fn commit_vote(
    ctx: Context<CommitVote>,
    commitment: [u8; 32],
    merkle_proof: Vec<[u8; 32]>,
    leaf_index: u32,
) -> Result<()> {
    require!(
        merkle_proof.len() <= MAX_MERKLE_PROOF_LEN,
        VotingError::MerkleProofInvalid
    );

    let proposal = &ctx.accounts.proposal;
    require!(
        proposal.phase == ProposalPhase::Commit,
        VotingError::NotCommitPhase
    );

    let now = Clock::get()?.unix_timestamp;
    require!(now < proposal.commit_ends_at, VotingError::NotCommitPhase);

    require_eligible(
        &ctx.accounts.voter.key(),
        proposal,
        &merkle_proof,
        leaf_index,
        ctx.accounts.granted_voter.as_ref().map(|a| a.as_ref()),
        ctx.accounts.revoked_voter.as_ref().map(|a| a.as_ref()),
    )?;

    let commitment_account = &ctx.accounts.commitment_account;
    let voter_key = ctx.accounts.voter.key();
    let already_committed = commitment_account.proposal == proposal.key()
        && commitment_account.voter == voter_key
        && commitment_account.commitment != [0u8; 32];
    require!(!already_committed, VotingError::AlreadyCommitted);

    let commitment_account = &mut ctx.accounts.commitment_account;
    commitment_account.proposal = proposal.key();
    commitment_account.voter = ctx.accounts.voter.key();
    commitment_account.commitment = commitment;
    commitment_account.revealed = false;
    commitment_account.bump = ctx.bumps.commitment_account;

    let slot = Clock::get()?.slot;
    emit!(VoteCommitted {
        proposal_id: proposal.proposal_id.clone(),
        voter_pubkey: commitment_account.voter,
        commitment,
        slot,
    });
    Ok(())
}

pub fn reveal_vote(ctx: Context<RevealVote>, option_id: String, salt: [u8; 32]) -> Result<()> {
    let proposal = &mut ctx.accounts.proposal;
    require!(proposal.phase.is_active(), VotingError::ProposalNotOpen);

    let now = Clock::get()?.unix_timestamp;
    require!(now >= proposal.commit_ends_at, VotingError::NotRevealPhase);
    require!(now < proposal.reveal_ends_at, VotingError::NotRevealPhase);

    if proposal.phase == ProposalPhase::Commit {
        proposal.phase = ProposalPhase::Reveal;
    }

    let commitment_account = &mut ctx.accounts.commitment_account;
    require!(!commitment_account.revealed, VotingError::AlreadyRevealed);

    let voter_bytes = ctx.accounts.voter.key().to_bytes();
    let expected = vote_commitment(&proposal.proposal_id, &salt, &voter_bytes, &option_id);
    require!(
        expected == commitment_account.commitment,
        VotingError::InvalidReveal
    );

    let idx = proposal
        .option_index(&option_id)
        .ok_or(VotingError::UnknownOptionId)?;
    proposal.option_counts[idx] = proposal.option_counts[idx]
        .checked_add(1)
        .ok_or(ProgramError::InvalidAccountData)?;

    commitment_account.revealed = true;

    let slot = Clock::get()?.slot;
    emit!(VoteRevealed {
        proposal_id: proposal.proposal_id.clone(),
        voter_pubkey: ctx.accounts.voter.key(),
        option_id,
        slot,
    });
    Ok(())
}
