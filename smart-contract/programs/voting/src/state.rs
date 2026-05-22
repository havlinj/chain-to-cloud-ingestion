use anchor_lang::prelude::*;

use crate::constants::{
    MAX_OPTION_LEN, MAX_OPTIONS, MAX_PROPOSAL_ID_LEN, MAX_TITLE_LEN, SEED_COMMITMENT,
    SEED_GRANTED, SEED_PROGRAM_CONFIG, SEED_PROPOSAL, SEED_REVOKED, SEED_VOTER_REGISTRY,
};
use crate::errors::VotingError;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ProposalPhase {
    Commit,
    Reveal,
    Finalized,
    Closed,
}

impl ProposalPhase {
    pub fn as_str(&self) -> &'static str {
        match self {
            ProposalPhase::Commit => "commit",
            ProposalPhase::Reveal => "reveal",
            ProposalPhase::Finalized => "finalized",
            ProposalPhase::Closed => "closed",
        }
    }

    pub fn is_active(&self) -> bool {
        matches!(self, ProposalPhase::Commit | ProposalPhase::Reveal)
    }
}

#[account]
pub struct VoterRegistry {
    pub authority: Pubkey,
    pub merkle_root: [u8; 32],
    pub version: u64,
    pub bump: u8,
}

impl VoterRegistry {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 1;
}

#[account]
pub struct ProgramConfig {
    pub active_proposal: Option<Pubkey>,
    pub bump: u8,
}

impl ProgramConfig {
    pub const LEN: usize = 8 + 1 + 32 + 1;
}

#[account]
pub struct Proposal {
    pub proposal_id: String,
    pub title: String,
    pub options: Vec<String>,
    pub commit_ends_at: i64,
    pub reveal_ends_at: i64,
    pub phase: ProposalPhase,
    pub electorate_merkle_root: [u8; 32],
    pub electorate_registry_version: u64,
    pub electorate_snapshot_slot: u64,
    pub option_counts: Vec<u64>,
    pub bump: u8,
}

impl Proposal {
    pub fn space(option_count: usize) -> usize {
        8
            + 4
            + MAX_PROPOSAL_ID_LEN
            + 4
            + MAX_TITLE_LEN
            + 4
            + option_count * (4 + MAX_OPTION_LEN)
            + 8
            + 8
            + 1
            + 32
            + 8
            + 8
            + 4
            + option_count * 8
            + 1
    }

    pub fn option_index(&self, option_id: &str) -> Option<usize> {
        self.options.iter().position(|o| o == option_id)
    }
}

#[account]
pub struct CommitmentAccount {
    pub proposal: Pubkey,
    pub voter: Pubkey,
    pub commitment: [u8; 32],
    pub revealed: bool,
    pub bump: u8,
}

impl CommitmentAccount {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 1 + 1;
}

#[account]
pub struct GrantedVoter {
    pub voter: Pubkey,
    pub granted_at_slot: u64,
    pub bump: u8,
}

impl GrantedVoter {
    pub const LEN: usize = 8 + 32 + 8 + 1;
}

#[account]
pub struct RevokedVoter {
    pub voter: Pubkey,
    pub revoked_at_slot: u64,
    pub bump: u8,
}

impl RevokedVoter {
    pub const LEN: usize = 8 + 32 + 8 + 1;
}

#[derive(Accounts)]
pub struct InitializeRegistry<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = VoterRegistry::LEN,
        seeds = [SEED_VOTER_REGISTRY],
        bump
    )]
    pub registry: Account<'info, VoterRegistry>,
    #[account(
        init,
        payer = authority,
        space = ProgramConfig::LEN,
        seeds = [SEED_PROGRAM_CONFIG],
        bump
    )]
    pub config: Account<'info, ProgramConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TransferAuthority<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [SEED_VOTER_REGISTRY],
        bump = registry.bump,
        has_one = authority @ VotingError::Unauthorized
    )]
    pub registry: Account<'info, VoterRegistry>,
}

#[derive(Accounts)]
pub struct UpdateMerkleRoot<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [SEED_VOTER_REGISTRY],
        bump = registry.bump,
        has_one = authority @ VotingError::Unauthorized
    )]
    pub registry: Account<'info, VoterRegistry>,
}

#[derive(Accounts)]
pub struct GrantEligibility<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        seeds = [SEED_VOTER_REGISTRY],
        bump = registry.bump,
        has_one = authority @ VotingError::Unauthorized
    )]
    pub registry: Account<'info, VoterRegistry>,
    /// CHECK: voter pubkey for PDA derivation only
    pub voter: UncheckedAccount<'info>,
    #[account(
        init,
        payer = authority,
        space = GrantedVoter::LEN,
        seeds = [SEED_GRANTED, voter.key().as_ref()],
        bump
    )]
    pub granted: Account<'info, GrantedVoter>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevokeEligibility<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        seeds = [SEED_VOTER_REGISTRY],
        bump = registry.bump,
        has_one = authority @ VotingError::Unauthorized
    )]
    pub registry: Account<'info, VoterRegistry>,
    /// CHECK: voter pubkey for PDA derivation only
    pub voter: UncheckedAccount<'info>,
    #[account(
        init,
        payer = authority,
        space = RevokedVoter::LEN,
        seeds = [SEED_REVOKED, voter.key().as_ref()],
        bump
    )]
    pub revoked: Account<'info, RevokedVoter>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(proposal_id: String, options: Vec<String>)]
pub struct CreateProposal<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_VOTER_REGISTRY], bump = registry.bump)]
    pub registry: Account<'info, VoterRegistry>,
    #[account(mut, seeds = [SEED_PROGRAM_CONFIG], bump = config.bump)]
    pub config: Account<'info, ProgramConfig>,
    #[account(
        init,
        payer = authority,
        space = Proposal::space(options.len()),
        seeds = [SEED_PROPOSAL, proposal_id.as_bytes()],
        bump
    )]
    pub proposal: Account<'info, Proposal>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CommitVote<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,
    #[account(
        seeds = [SEED_PROPOSAL, proposal.proposal_id.as_bytes()],
        bump = proposal.bump
    )]
    pub proposal: Account<'info, Proposal>,
    #[account(
        init,
        payer = voter,
        space = CommitmentAccount::LEN,
        seeds = [SEED_COMMITMENT, proposal.key().as_ref(), voter.key().as_ref()],
        bump
    )]
    pub commitment_account: Account<'info, CommitmentAccount>,
    /// Optional: granted-voter PDA when voter is not in the frozen Merkle tree.
    #[account(
        seeds = [SEED_GRANTED, voter.key().as_ref()],
        bump
    )]
    pub granted_voter: Option<Account<'info, GrantedVoter>>,
    /// Optional: revoked-voter PDA evaluated against proposal snapshot slot.
    #[account(
        seeds = [SEED_REVOKED, voter.key().as_ref()],
        bump
    )]
    pub revoked_voter: Option<Account<'info, RevokedVoter>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevealVote<'info> {
    pub voter: Signer<'info>,
    #[account(
        mut,
        seeds = [SEED_PROPOSAL, proposal.proposal_id.as_bytes()],
        bump = proposal.bump
    )]
    pub proposal: Account<'info, Proposal>,
    #[account(
        mut,
        seeds = [SEED_COMMITMENT, proposal.key().as_ref(), voter.key().as_ref()],
        bump = commitment_account.bump,
        constraint = commitment_account.voter == voter.key() @ VotingError::NotCommitted,
        constraint = commitment_account.proposal == proposal.key() @ VotingError::NotCommitted
    )]
    pub commitment_account: Account<'info, CommitmentAccount>,
}

#[derive(Accounts)]
pub struct CloseProposal<'info> {
    pub authority: Signer<'info>,
    #[account(
        seeds = [SEED_VOTER_REGISTRY],
        bump = registry.bump,
        has_one = authority @ VotingError::Unauthorized
    )]
    pub registry: Account<'info, VoterRegistry>,
    #[account(mut, seeds = [SEED_PROGRAM_CONFIG], bump = config.bump)]
    pub config: Account<'info, ProgramConfig>,
    #[account(
        mut,
        seeds = [SEED_PROPOSAL, proposal.proposal_id.as_bytes()],
        bump = proposal.bump
    )]
    pub proposal: Account<'info, Proposal>,
}

#[derive(Accounts)]
pub struct FinalizeProposal<'info> {
    #[account(
        mut,
        seeds = [SEED_PROPOSAL, proposal.proposal_id.as_bytes()],
        bump = proposal.bump
    )]
    pub proposal: Account<'info, Proposal>,
    #[account(mut, seeds = [SEED_PROGRAM_CONFIG], bump = config.bump)]
    pub config: Account<'info, ProgramConfig>,
}
