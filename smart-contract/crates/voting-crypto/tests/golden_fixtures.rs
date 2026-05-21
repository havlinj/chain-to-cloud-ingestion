//! Assert ADR golden fixtures match `voting-crypto` (same algorithms as Python generator).

use std::fs;
use std::path::PathBuf;

use serde::Deserialize;
use voting_crypto::{
    build_merkle_proof, canonical_list_hash, encode_base58, merkle_leaf,
    merkle_root_from_pubkeys, verify_merkle_proof, vote_commitment,
};

fn fixtures_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../tests/fixtures")
}

#[derive(Deserialize)]
struct ElectorateGolden {
    canonical_list_utf8: String,
    list_hash_sha256_hex: String,
    pubkeys_hex: Vec<String>,
    merkle_leaves_keccak256_hex: Vec<String>,
    merkle_root_keccak256_hex: String,
    merkle_root_base58: String,
}

#[derive(Deserialize)]
struct CommitmentGolden {
    proposal_id: String,
    option_id: String,
    salt_hex: String,
    voter_pubkey_hex: String,
    sha256_hex: String,
    commitment_base58: String,
}

#[test]
fn golden_0001_list_hash_and_merkle_root() {
    let dir = fixtures_dir();
    let list_bytes = fs::read(dir.join("golden-0001-voter-list-input.txt")).expect("read list");
    let expected_json =
        fs::read_to_string(dir.join("golden-0001-list-hash-and-merkle-expected.json"))
            .expect("read expected");
    let golden: ElectorateGolden = serde_json::from_str(&expected_json).expect("parse json");

    let hash = canonical_list_hash(&list_bytes);
    assert_eq!(hex::encode(hash), golden.list_hash_sha256_hex);
    assert_eq!(
        String::from_utf8_lossy(&list_bytes),
        golden.canonical_list_utf8
    );

    let pubkeys: Vec<[u8; 32]> = golden
        .pubkeys_hex
        .iter()
        .map(|h| {
            let bytes = hex::decode(h).expect("hex pubkey");
            let mut pk = [0u8; 32];
            pk.copy_from_slice(&bytes);
            pk
        })
        .collect();

    for (pk, expected_leaf) in pubkeys.iter().zip(golden.merkle_leaves_keccak256_hex.iter()) {
        assert_eq!(hex::encode(merkle_leaf(pk)), *expected_leaf);
    }

    let leaves: Vec<[u8; 32]> = pubkeys.iter().map(merkle_leaf).collect();
    let root = merkle_root_from_pubkeys(&pubkeys);
    assert_eq!(hex::encode(root), golden.merkle_root_keccak256_hex);
    assert_eq!(encode_base58(&root), golden.merkle_root_base58);

    for (i, leaf) in leaves.iter().enumerate() {
        let proof = build_merkle_proof(&leaves, i);
        verify_merkle_proof(*leaf, &proof, root, i).expect("merkle proof verifies");
    }
}

#[test]
fn golden_0003_vote_commitment() {
    let dir = fixtures_dir();
    let expected_json =
        fs::read_to_string(dir.join("golden-0003-vote-commitment-expected.json"))
            .expect("read expected");
    let golden: CommitmentGolden = serde_json::from_str(&expected_json).expect("parse json");

    let salt_bytes = hex::decode(&golden.salt_hex).expect("salt hex");
    let mut salt = [0u8; 32];
    salt.copy_from_slice(&salt_bytes);

    let voter_bytes = hex::decode(&golden.voter_pubkey_hex).expect("voter hex");
    let mut voter = [0u8; 32];
    voter.copy_from_slice(&voter_bytes);

    let digest = vote_commitment(&golden.proposal_id, &salt, &voter, &golden.option_id);
    assert_eq!(hex::encode(digest), golden.sha256_hex);
    assert_eq!(encode_base58(&digest), golden.commitment_base58);
}
