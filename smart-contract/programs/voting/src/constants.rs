/// PDA seed for global voter registry account.
pub const SEED_VOTER_REGISTRY: &[u8] = b"voter_registry";
/// PDA seed for program-wide config (active proposal pointer).
pub const SEED_PROGRAM_CONFIG: &[u8] = b"program_config";
/// PDA seed prefix for a proposal account.
pub const SEED_PROPOSAL: &[u8] = b"proposal";
/// PDA seed prefix for a vote commitment account.
pub const SEED_COMMITMENT: &[u8] = b"commitment";
/// PDA seed prefix for a granted-voter marker.
pub const SEED_GRANTED: &[u8] = b"granted";
/// PDA seed prefix for a revoked-voter marker.
pub const SEED_REVOKED: &[u8] = b"revoked";

pub const MAX_PROPOSAL_ID_LEN: usize = 64;
pub const MAX_TITLE_LEN: usize = 128;
pub const MAX_OPTIONS: usize = 16;
pub const MAX_OPTION_LEN: usize = 64;
pub const MAX_MERKLE_PROOF_LEN: usize = 32;
