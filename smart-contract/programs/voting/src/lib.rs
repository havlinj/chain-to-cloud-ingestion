//! On-chain voting program (Anchor): Merkle registry, commit–reveal, frozen electorate.
//! Cryptography in `voting-crypto`; behavior per Accepted ADRs 0001–0003.

use anchor_lang::prelude::*;

pub mod constants;
pub mod eligibility;
pub mod eligibility_pda;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use state::*;

declare_id!("VotiNG1111111111111111111111111111111111111");

#[program]
pub mod voting {
    use super::*;

    pub fn initialize_registry(
        ctx: Context<InitializeRegistry>,
        merkle_root: [u8; 32],
    ) -> Result<()> {
        instructions::registry::initialize_registry(ctx, merkle_root)
    }

    pub fn transfer_authority(
        ctx: Context<TransferAuthority>,
        new_authority: Pubkey,
    ) -> Result<()> {
        instructions::registry::transfer_authority(ctx, new_authority)
    }

    pub fn update_merkle_root(
        ctx: Context<UpdateMerkleRoot>,
        new_root: [u8; 32],
        list_hash: [u8; 32],
    ) -> Result<()> {
        instructions::registry::update_merkle_root(ctx, new_root, list_hash)
    }

    pub fn grant_eligibility(ctx: Context<GrantEligibility>) -> Result<()> {
        instructions::registry::grant_eligibility(ctx)
    }

    pub fn revoke_eligibility(ctx: Context<RevokeEligibility>) -> Result<()> {
        instructions::registry::revoke_eligibility(ctx)
    }

    pub fn create_proposal(
        ctx: Context<CreateProposal>,
        proposal_id: String,
        title: String,
        options: Vec<String>,
        commit_ends_at: i64,
        reveal_ends_at: i64,
    ) -> Result<()> {
        instructions::proposal::create_proposal(
            ctx,
            proposal_id,
            title,
            options,
            commit_ends_at,
            reveal_ends_at,
        )
    }

    pub fn commit_vote(
        ctx: Context<CommitVote>,
        commitment: [u8; 32],
        merkle_proof: Vec<[u8; 32]>,
        leaf_index: u32,
    ) -> Result<()> {
        instructions::vote::commit_vote(ctx, commitment, merkle_proof, leaf_index)
    }

    pub fn reveal_vote(
        ctx: Context<RevealVote>,
        option_id: String,
        salt: [u8; 32],
    ) -> Result<()> {
        instructions::vote::reveal_vote(ctx, option_id, salt)
    }

    pub fn close_proposal(ctx: Context<CloseProposal>) -> Result<()> {
        instructions::proposal::close_proposal(ctx)
    }

    pub fn finalize_proposal(ctx: Context<FinalizeProposal>) -> Result<()> {
        instructions::proposal::finalize_proposal(ctx)
    }
}
