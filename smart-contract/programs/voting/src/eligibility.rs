use anchor_lang::prelude::*;
use voting_crypto::{merkle_leaf, verify_merkle_proof, MerkleProofError};

use crate::errors::VotingError;
use crate::state::{GrantedVoter, Proposal, RevokedVoter};

/// Returns true if the voter may commit on this proposal (ADR 0001 + architecture §8).
pub fn is_voter_eligible(
    voter: &Pubkey,
    proposal: &Proposal,
    merkle_proof: &[[u8; 32]],
    leaf_index: u32,
    granted: Option<&GrantedVoter>,
    revoked: Option<&RevokedVoter>,
) -> Result<bool> {
    let voter_bytes = voter.to_bytes();
    let leaf = merkle_leaf(&voter_bytes);
    if !merkle_proof.is_empty() {
        if verify_merkle_proof(leaf, merkle_proof, proposal.electorate_merkle_root, leaf_index as usize)
            .is_ok()
        {
            return Ok(true);
        }
    }
    if let Some(grant) = granted {
        if grant.granted_at_slot <= proposal.electorate_snapshot_slot {
            if let Some(rev) = revoked {
                return Ok(rev.revoked_at_slot > proposal.electorate_snapshot_slot);
            }
            return Ok(true);
        }
    }
    Ok(false)
}

pub fn require_eligible(
    voter: &Pubkey,
    proposal: &Proposal,
    merkle_proof: &[[u8; 32]],
    leaf_index: u32,
    granted: Option<&GrantedVoter>,
    revoked: Option<&RevokedVoter>,
) -> Result<()> {
    if is_voter_eligible(voter, proposal, merkle_proof, leaf_index, granted, revoked)? {
        return Ok(());
    }
    if !merkle_proof.is_empty() {
        let leaf = merkle_leaf(&voter.to_bytes());
        if matches!(
            verify_merkle_proof(
                leaf,
                merkle_proof,
                proposal.electorate_merkle_root,
                leaf_index as usize
            ),
            Err(MerkleProofError::RootMismatch) | Err(MerkleProofError::EmptyProof)
        ) {
            return err!(VotingError::MerkleProofInvalid);
        }
    }
    err!(VotingError::NotEligible)
}
