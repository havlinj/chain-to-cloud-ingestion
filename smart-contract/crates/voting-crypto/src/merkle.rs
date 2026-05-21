use sha3::{Digest, Keccak256};

#[derive(Debug, PartialEq, Eq)]
pub enum MerkleProofError {
    EmptyProof,
    RootMismatch,
}

/// Merkle root from leaf digests (already `keccak256(pubkey)`), ADR 0001 pair rule.
pub fn merkle_root(leaves: &[[u8; 32]]) -> [u8; 32] {
    assert!(!leaves.is_empty(), "merkle tree requires at least one leaf");
    let mut level: Vec<[u8; 32]> = leaves.to_vec();
    while level.len() > 1 {
        level = parent_level(&level);
    }
    level[0]
}

/// Parent level: pair `keccak256(min‖max)`; odd count duplicates the last node.
fn parent_level(level: &[[u8; 32]]) -> Vec<[u8; 32]> {
    let mut next = Vec::with_capacity((level.len() + 1) / 2);
    let mut i = 0;
    while i < level.len() {
        let left = level[i];
        let right = if i + 1 < level.len() {
            level[i + 1]
        } else {
            level[i]
        };
        next.push(pair_hash(left, right));
        i += 2;
    }
    next
}

fn pair_hash(left: [u8; 32], right: [u8; 32]) -> [u8; 32] {
    let (lo, hi) = if right < left {
        (right, left)
    } else {
        (left, right)
    };
    let mut hasher = Keccak256::new();
    hasher.update(lo);
    hasher.update(hi);
    hasher.finalize().into()
}

/// Build a Merkle proof for `leaf_index` (0-based, leaves sorted by pubkey order).
pub fn build_merkle_proof(leaves: &[[u8; 32]], leaf_index: usize) -> Vec<[u8; 32]> {
    assert!(leaf_index < leaves.len());
    let mut proof = Vec::new();
    let mut index = leaf_index;
    let mut level = leaves.to_vec();
    while level.len() > 1 {
        let sibling = sibling_at(&level, index);
        proof.push(sibling);
        level = parent_level(&level);
        index /= 2;
    }
    proof
}

fn sibling_at(level: &[[u8; 32]], index: usize) -> [u8; 32] {
    if index % 2 == 0 {
        if index + 1 < level.len() {
            level[index + 1]
        } else {
            level[index]
        }
    } else {
        level[index - 1]
    }
}

/// Verify a proof for one leaf against an expected root (used at `commit_vote`).
pub fn verify_merkle_proof(
    leaf: [u8; 32],
    proof: &[[u8; 32]],
    root: [u8; 32],
    leaf_index: usize,
) -> Result<(), MerkleProofError> {
    if proof.is_empty() && leaf != root {
        return Err(MerkleProofError::EmptyProof);
    }
    let mut computed = leaf;
    let mut index = leaf_index;
    for sibling in proof {
        computed = if index % 2 == 0 {
            pair_hash(computed, *sibling)
        } else {
            pair_hash(*sibling, computed)
        };
        index /= 2;
    }
    if computed == root {
        Ok(())
    } else {
        Err(MerkleProofError::RootMismatch)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn verify_matches_build_for_three_leaves() {
        let leaves: Vec<[u8; 32]> = (1u8..=3)
            .map(|n| {
                let mut leaf = [0u8; 32];
                leaf[31] = n;
                Keccak256::digest(&leaf).into()
            })
            .collect();
        let root = merkle_root(&leaves);
        for (i, leaf) in leaves.iter().enumerate() {
            let proof = build_merkle_proof(&leaves, i);
            verify_merkle_proof(*leaf, &proof, root, i).expect("proof should verify");
        }
    }
}
