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
    if merkle_proof.is_empty() {
        if leaf == proposal.electorate_merkle_root {
            return Ok(true);
        }
    } else if verify_merkle_proof(
        leaf,
        merkle_proof,
        proposal.electorate_merkle_root,
        leaf_index as usize,
    )
    .is_ok()
    {
        return Ok(true);
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::{Proposal, ProposalPhase};

    fn proposal_with_root(root: [u8; 32]) -> Proposal {
        Proposal {
            proposal_id: "p1".to_string(),
            title: "t".to_string(),
            options: vec!["a".to_string(), "b".to_string()],
            commit_ends_at: 0,
            reveal_ends_at: 0,
            phase: ProposalPhase::Commit,
            electorate_merkle_root: root,
            electorate_registry_version: 1,
            electorate_snapshot_slot: 100,
            option_counts: vec![0, 0],
            bump: 0,
        }
    }

    #[test]
    fn single_leaf_empty_proof_matches_root() {
        let voter = Pubkey::new_unique();
        let leaf = merkle_leaf(&voter.to_bytes());
        let proposal = proposal_with_root(leaf);
        assert!(is_voter_eligible(&voter, &proposal, &[], 0, None, None).unwrap());
    }

    #[test]
    fn single_leaf_empty_proof_rejects_wrong_root() {
        let voter = Pubkey::new_unique();
        let mut wrong_root = merkle_leaf(&voter.to_bytes());
        wrong_root[0] ^= 0xff;
        let proposal = proposal_with_root(wrong_root);
        assert!(!is_voter_eligible(&voter, &proposal, &[], 0, None, None).unwrap());
    }
}
