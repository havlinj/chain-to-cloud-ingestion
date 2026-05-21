//! Pure cryptographic helpers for the voting program (ADR 0001, 0003).
//!
//! Kept in a separate crate so golden fixture tests run without Anchor/Solana tooling.

mod base58;
mod commitment;
mod electorate;
mod merkle;

pub use base58::{decode_pubkey, encode_base58};
pub use commitment::vote_commitment;
pub use electorate::{canonical_list_hash, merkle_leaf, merkle_root_from_pubkeys};
pub use merkle::{build_merkle_proof, verify_merkle_proof, MerkleProofError};
