use sha2::{Digest, Sha256};

/// Vote commitment per ADR 0003: SHA-256 over UTF-8 proposal_id ‖ 32-byte salt ‖
/// 32-byte voter pubkey ‖ UTF-8 option_id (no separators).
pub fn vote_commitment(
    proposal_id: &str,
    salt: &[u8; 32],
    voter_pubkey: &[u8; 32],
    option_id: &str,
) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(proposal_id.as_bytes());
    hasher.update(salt);
    hasher.update(voter_pubkey);
    hasher.update(option_id.as_bytes());
    hasher.finalize().into()
}
