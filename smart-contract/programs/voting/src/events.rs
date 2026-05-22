use anchor_lang::prelude::*;

#[event]
pub struct ProposalCreated {
    pub proposal_id: String,
    pub title: String,
    pub options: Vec<String>,
    pub commit_ends_at: i64,
    pub reveal_ends_at: i64,
    pub phase: String,
    pub electorate_merkle_root: [u8; 32],
    pub electorate_registry_version: u64,
    pub electorate_snapshot_slot: u64,
    pub slot: u64,
}

#[event]
pub struct VoteCommitted {
    pub proposal_id: String,
    pub voter_pubkey: Pubkey,
    pub commitment: [u8; 32],
    pub slot: u64,
}

#[event]
pub struct VoteRevealed {
    pub proposal_id: String,
    pub voter_pubkey: Pubkey,
    pub option_id: String,
    pub slot: u64,
}

#[event]
pub struct ProposalClosed {
    pub proposal_id: String,
    pub slot: u64,
}

#[event]
pub struct ProposalFinalized {
    pub proposal_id: String,
    pub slot: u64,
}

#[event]
pub struct EligibleVotersRootUpdated {
    pub merkle_root: [u8; 32],
    pub registry_version: u64,
    pub list_hash: [u8; 32],
    pub slot: u64,
}

#[event]
pub struct VoterEligibilityGranted {
    pub voter_pubkey: Pubkey,
    pub slot: u64,
}

#[event]
pub struct VoterEligibilityRevoked {
    pub voter_pubkey: Pubkey,
    pub slot: u64,
}
