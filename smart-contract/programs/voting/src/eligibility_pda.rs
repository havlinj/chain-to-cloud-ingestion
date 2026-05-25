//! Explicit PDA allocation for grant/revoke markers (no Anchor `init` macro).

use anchor_lang::error::ErrorCode;
use anchor_lang::prelude::*;
use anchor_lang::system_program::{create_account, CreateAccount};
use anchor_lang::Discriminator;

use crate::constants::{SEED_GRANTED, SEED_REVOKED};
use crate::errors::VotingError;
use crate::state::{GrantedVoter, RevokedVoter};

fn reject_if_marker_exists(
    account: &AccountInfo,
    program_id: &Pubkey,
    duplicate: VotingError,
) -> Result<()> {
    if account.lamports() == 0 {
        return Ok(());
    }
    require!(
        account.owner == program_id,
        ErrorCode::AccountOwnedByWrongProgram
    );
    return Err(duplicate.into());
}

fn create_marker_pda<'info>(
    account: &AccountInfo<'info>,
    payer: &AccountInfo<'info>,
    system_program: &AccountInfo<'info>,
    program_id: &Pubkey,
    space: usize,
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    let rent = Rent::get()?;
    let lamports = rent.minimum_balance(space);
    create_account(
        CpiContext::new_with_signer(
            system_program.clone(),
            CreateAccount {
                from: payer.clone(),
                to: account.clone(),
            },
            signer_seeds,
        ),
        lamports,
        space as u64,
        program_id,
    )
}

fn write_marker<T: AccountSerialize + Discriminator>(
    account: &AccountInfo,
    state: &T,
) -> Result<()> {
    let mut data = account.try_borrow_mut_data()?;
    require!(data.len() >= 8, ErrorCode::AccountDidNotSerialize);
    data[..8].copy_from_slice(T::DISCRIMINATOR);
    let mut cursor: &mut [u8] = &mut data[8..];
    state.try_serialize(&mut cursor)?;
    Ok(())
}

fn init_marker_account<'info, T, F>(
    account: &AccountInfo<'info>,
    payer: &AccountInfo<'info>,
    system_program: &AccountInfo<'info>,
    seed_prefix: &[u8],
    voter: &Pubkey,
    bump: u8,
    space: usize,
    duplicate: VotingError,
    build_state: F,
) -> Result<T>
where
    T: AccountSerialize + Discriminator,
    F: FnOnce(Pubkey, u64, u8) -> T,
{
    reject_if_marker_exists(account, &crate::ID, duplicate)?;
    let seeds: &[&[u8]] = &[seed_prefix, voter.as_ref(), &[bump]];
    create_marker_pda(
        account,
        payer,
        system_program,
        &crate::ID,
        space,
        &[seeds],
    )?;
    let slot = Clock::get()?.slot;
    let state = build_state(*voter, slot, bump);
    write_marker(account, &state)?;
    Ok(state)
}

pub fn init_granted_voter<'info>(
    granted: &AccountInfo<'info>,
    payer: &AccountInfo<'info>,
    system_program: &AccountInfo<'info>,
    voter: &Pubkey,
    bump: u8,
) -> Result<GrantedVoter> {
    init_marker_account(
        granted,
        payer,
        system_program,
        SEED_GRANTED,
        voter,
        bump,
        GrantedVoter::LEN,
        VotingError::AlreadyGranted,
        |voter, slot, bump| GrantedVoter {
            voter,
            granted_at_slot: slot,
            bump,
        },
    )
}

pub fn init_revoked_voter<'info>(
    revoked: &AccountInfo<'info>,
    payer: &AccountInfo<'info>,
    system_program: &AccountInfo<'info>,
    voter: &Pubkey,
    bump: u8,
) -> Result<RevokedVoter> {
    init_marker_account(
        revoked,
        payer,
        system_program,
        SEED_REVOKED,
        voter,
        bump,
        RevokedVoter::LEN,
        VotingError::AlreadyRevoked,
        |voter, slot, bump| RevokedVoter {
            voter,
            revoked_at_slot: slot,
            bump,
        },
    )
}
