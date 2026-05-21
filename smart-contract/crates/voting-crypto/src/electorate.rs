use sha2::{Digest, Sha256};
use sha3::Keccak256;

use crate::merkle::merkle_root;

/// SHA-256 of the canonical off-chain voter list file bytes (ADR 0001).
pub fn canonical_list_hash(canonical_file_bytes: &[u8]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(canonical_file_bytes);
    hasher.finalize().into()
}

/// Merkle leaf: `keccak256(32-byte Ed25519 pubkey)` (ADR 0001).
pub fn merkle_leaf(pubkey_bytes: &[u8; 32]) -> [u8; 32] {
    Keccak256::digest(pubkey_bytes).into()
}

/// Build Merkle root from leaves in **sorted leaf order** (caller sorts pubkeys first).
pub fn merkle_root_from_pubkeys(pubkeys: &[[u8; 32]]) -> [u8; 32] {
    let leaves: Vec<[u8; 32]> = pubkeys.iter().map(merkle_leaf).collect();
    merkle_root(&leaves)
}
