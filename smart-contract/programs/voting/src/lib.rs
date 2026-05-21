//! On-chain voting program (Anchor). Iteration 2A: program shell + shared `voting-crypto`.
//! Instructions and accounts land in iteration 2B per Accepted ADRs 0001–0003.

use anchor_lang::prelude::*;

pub use voting_crypto;

declare_id!("VotiNG1111111111111111111111111111111111111");

#[program]
pub mod voting {
    use super::*;

    /// Placeholder until 2B wires registry, proposals, commit/reveal instructions.
    pub fn initialize_stub(_ctx: Context<InitializeStub>) -> Result<()> {
        msg!("voting program scaffold (2A); use voting-crypto golden tests");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeStub {}
