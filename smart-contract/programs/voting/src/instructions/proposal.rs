use anchor_lang::prelude::*;

use crate::constants::{MAX_OPTION_LEN, MAX_OPTIONS, MAX_PROPOSAL_ID_LEN, MAX_TITLE_LEN};
use crate::errors::VotingError;
use crate::events::{ProposalClosed, ProposalCreated, ProposalFinalized};
use crate::state::{
    CloseProposal, CreateProposal, FinalizeProposal, Proposal, ProposalPhase, ProgramConfig,
};

fn validate_proposal_id(proposal_id: &str) -> Result<()> {
    require!(
        !proposal_id.is_empty() && proposal_id.len() <= MAX_PROPOSAL_ID_LEN,
        VotingError::ProposalIdTooLong
    );
    Ok(())
}

fn validate_title(title: &str) -> Result<()> {
    require!(
        !title.is_empty() && title.len() <= MAX_TITLE_LEN,
        VotingError::TitleTooLong
    );
    Ok(())
}

fn validate_options(options: &[String]) -> Result<()> {
    require!(
        options.len() >= 2 && options.len() <= MAX_OPTIONS,
        VotingError::InvalidOptions
    );
    for opt in options {
        require!(
            !opt.is_empty() && opt.len() <= MAX_OPTION_LEN,
            VotingError::InvalidOptions
        );
    }
    Ok(())
}

pub fn create_proposal(
    ctx: Context<CreateProposal>,
    proposal_id: String,
    title: String,
    options: Vec<String>,
    commit_ends_at: i64,
    reveal_ends_at: i64,
) -> Result<()> {
    validate_proposal_id(&proposal_id)?;
    validate_title(&title)?;
    validate_options(&options)?;

    let now = Clock::get()?.unix_timestamp;
    require!(commit_ends_at > now, VotingError::CommitEndsInPast);
    require!(
        reveal_ends_at > commit_ends_at,
        VotingError::RevealBeforeCommitEnd
    );

    require!(
        ctx.accounts.config.active_proposal.is_none(),
        VotingError::ActiveProposalExists
    );

    let registry = &ctx.accounts.registry;
    let slot = Clock::get()?.slot;

    let proposal = &mut ctx.accounts.proposal;
    proposal.proposal_id = proposal_id;
    proposal.title = title;
    proposal.options = options;
    proposal.commit_ends_at = commit_ends_at;
    proposal.reveal_ends_at = reveal_ends_at;
    proposal.phase = ProposalPhase::Commit;
    proposal.electorate_merkle_root = registry.merkle_root;
    proposal.electorate_registry_version = registry.version;
    proposal.electorate_snapshot_slot = slot;
    proposal.option_counts = vec![0u64; proposal.options.len()];
    proposal.bump = ctx.bumps.proposal;

    let config = &mut ctx.accounts.config;
    config.active_proposal = Some(proposal.key());

    emit!(ProposalCreated {
        proposal_id: proposal.proposal_id.clone(),
        title: proposal.title.clone(),
        options: proposal.options.clone(),
        commit_ends_at,
        reveal_ends_at,
        phase: ProposalPhase::Commit.as_str().to_string(),
        electorate_merkle_root: proposal.electorate_merkle_root,
        electorate_registry_version: proposal.electorate_registry_version,
        electorate_snapshot_slot: proposal.electorate_snapshot_slot,
        slot,
    });
    Ok(())
}

pub fn close_proposal(ctx: Context<CloseProposal>) -> Result<()> {
    let proposal = &mut ctx.accounts.proposal;
    require!(proposal.phase.is_active(), VotingError::ProposalNotOpen);

    proposal.phase = ProposalPhase::Closed;
    clear_active_if_match(&mut ctx.accounts.config, proposal.key());

    emit!(ProposalClosed {
        proposal_id: proposal.proposal_id.clone(),
        slot: Clock::get()?.slot,
    });
    Ok(())
}

pub fn finalize_proposal(ctx: Context<FinalizeProposal>) -> Result<()> {
    let proposal = &mut ctx.accounts.proposal;
    require!(proposal.phase.is_active(), VotingError::ProposalNotOpen);

    let now = Clock::get()?.unix_timestamp;
    require!(now >= proposal.reveal_ends_at, VotingError::RevealNotEnded);

    proposal.phase = ProposalPhase::Finalized;
    clear_active_if_match(&mut ctx.accounts.config, proposal.key());

    emit!(ProposalFinalized {
        proposal_id: proposal.proposal_id.clone(),
        slot: Clock::get()?.slot,
    });
    Ok(())
}

fn clear_active_if_match(config: &mut Account<ProgramConfig>, proposal_key: Pubkey) {
    if config.active_proposal == Some(proposal_key) {
        config.active_proposal = None;
    }
}
