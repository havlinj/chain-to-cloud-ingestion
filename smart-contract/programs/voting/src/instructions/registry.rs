use anchor_lang::prelude::*;

use crate::eligibility_pda::{init_granted_voter, init_revoked_voter};
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

pub fn transfer_authority(
    ctx: Context<TransferAuthority>,
    new_authority: Pubkey,
) -> Result<()> {
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
    let voter = ctx.accounts.voter.key();
    let granted = init_granted_voter(
        &ctx.accounts.granted.to_account_info(),
        &ctx.accounts.authority.to_account_info(),
        &ctx.accounts.system_program.to_account_info(),
        &voter,
        ctx.bumps.granted,
    )?;

    emit!(VoterEligibilityGranted {
        voter_pubkey: granted.voter,
        slot: granted.granted_at_slot,
    });
    Ok(())
}

pub fn revoke_eligibility(ctx: Context<RevokeEligibility>) -> Result<()> {
    let voter = ctx.accounts.voter.key();
    let revoked = init_revoked_voter(
        &ctx.accounts.revoked.to_account_info(),
        &ctx.accounts.authority.to_account_info(),
        &ctx.accounts.system_program.to_account_info(),
        &voter,
        ctx.bumps.revoked,
    )?;

    emit!(VoterEligibilityRevoked {
        voter_pubkey: revoked.voter,
        slot: revoked.revoked_at_slot,
    });
    Ok(())
}
