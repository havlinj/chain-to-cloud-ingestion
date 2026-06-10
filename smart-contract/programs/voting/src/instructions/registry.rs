use anchor_lang::prelude::*;

use crate::errors::VotingError;
use crate::events::{EligibleVotersRootUpdated, VoterEligibilityGranted, VoterEligibilityRevoked};
use crate::state::{
    GrantEligibility, InitializeRegistry, RevokeEligibility, TransferAuthority, UpdateMerkleRoot,
};

pub fn initialize_registry(ctx: Context<InitializeRegistry>, merkle_root: [u8; 32]) -> Result<()> {
    let registry = &mut ctx.accounts.registry;
    registry.authority = ctx.accounts.authority.key();
    registry.merkle_root = merkle_root;
    registry.version = 1;
    registry.bump = ctx.bumps.registry;

    let config = &mut ctx.accounts.config;
    config.active_proposal = None;
    config.bump = ctx.bumps.config;
    Ok(())
}

pub fn transfer_authority(ctx: Context<TransferAuthority>, new_authority: Pubkey) -> Result<()> {
    ctx.accounts.registry.authority = new_authority;
    Ok(())
}

pub fn update_merkle_root(
    ctx: Context<UpdateMerkleRoot>,
    new_root: [u8; 32],
    list_hash: [u8; 32],
) -> Result<()> {
    let registry = &mut ctx.accounts.registry;
    registry.merkle_root = new_root;
    registry.version = registry
        .version
        .checked_add(1)
        .ok_or(ProgramError::InvalidAccountData)?;

    let slot = Clock::get()?.slot;
    emit!(EligibleVotersRootUpdated {
        merkle_root: new_root,
        registry_version: registry.version,
        list_hash,
        slot,
    });
    Ok(())
}

pub fn grant_eligibility(ctx: Context<GrantEligibility>) -> Result<()> {
    let granted = &mut ctx.accounts.granted;
    require!(granted.granted_at_slot == 0, VotingError::AlreadyGranted);

    let slot = Clock::get()?.slot;
    granted.voter = ctx.accounts.voter.key();
    granted.granted_at_slot = slot;
    granted.bump = ctx.bumps.granted;

    emit!(VoterEligibilityGranted {
        voter_pubkey: granted.voter,
        slot,
    });
    Ok(())
}

pub fn revoke_eligibility(ctx: Context<RevokeEligibility>) -> Result<()> {
    let revoked = &mut ctx.accounts.revoked;
    require!(revoked.revoked_at_slot == 0, VotingError::AlreadyRevoked);

    let slot = Clock::get()?.slot;
    revoked.voter = ctx.accounts.voter.key();
    revoked.revoked_at_slot = slot;
    revoked.bump = ctx.bumps.revoked;

    emit!(VoterEligibilityRevoked {
        voter_pubkey: revoked.voter,
        slot,
    });
    Ok(())
}
