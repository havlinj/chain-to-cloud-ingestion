use anchor_lang::prelude::*;

#[error_code]
pub enum VotingError {
    #[msg("proposal id exceeds maximum length")]
    ProposalIdTooLong,
    #[msg("title exceeds maximum length")]
    TitleTooLong,
    #[msg("too many options or option label too long")]
    InvalidOptions,
    #[msg("commit deadline must be in the future")]
    CommitEndsInPast,
    #[msg("reveal deadline must be after commit deadline")]
    RevealBeforeCommitEnd,
    #[msg("another proposal is already active in commit or reveal phase")]
    ActiveProposalExists,
    #[msg("voting is not in commit phase")]
    NotCommitPhase,
    #[msg("voting is not in reveal phase")]
    NotRevealPhase,
    #[msg("proposal is already finalized or closed")]
    ProposalNotOpen,
    #[msg("caller is not registry authority")]
    Unauthorized,
    #[msg("voter is not eligible for this proposal")]
    NotEligible,
    #[msg("merkle proof verification failed")]
    MerkleProofInvalid,
    #[msg("voter already committed on this proposal")]
    AlreadyCommitted,
    #[msg("commitment account not found or not committed")]
    NotCommitted,
    #[msg("vote already revealed")]
    AlreadyRevealed,
    #[msg("reveal does not match commitment")]
    InvalidReveal,
    #[msg("unknown option id for this proposal")]
    UnknownOptionId,
    #[msg("reveal phase has not ended yet")]
    RevealNotEnded,
    #[msg("voter already granted")]
    AlreadyGranted,
    #[msg("voter already revoked")]
    AlreadyRevoked,
}
