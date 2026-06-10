import { PublicKey } from "@solana/web3.js";

const SEED_VOTER_REGISTRY = Buffer.from("voter_registry");
const SEED_PROGRAM_CONFIG = Buffer.from("program_config");
const SEED_PROPOSAL = Buffer.from("proposal");
const SEED_COMMITMENT = Buffer.from("commitment");
const SEED_GRANTED = Buffer.from("granted");
const SEED_REVOKED = Buffer.from("revoked");

export function voterRegistryPda(programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([SEED_VOTER_REGISTRY], programId)[0];
}

export function programConfigPda(programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([SEED_PROGRAM_CONFIG], programId)[0];
}

export function proposalPda(programId: PublicKey, proposalId: string): PublicKey {
  return PublicKey.findProgramAddressSync(
    [SEED_PROPOSAL, Buffer.from(proposalId, "utf8")],
    programId
  )[0];
}

export function commitmentPda(
  programId: PublicKey,
  proposal: PublicKey,
  voter: PublicKey
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [SEED_COMMITMENT, proposal.toBuffer(), voter.toBuffer()],
    programId
  )[0];
}

export function grantedVoterPda(programId: PublicKey, voter: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([SEED_GRANTED, voter.toBuffer()], programId)[0];
}

export function revokedVoterPda(programId: PublicKey, voter: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([SEED_REVOKED, voter.toBuffer()], programId)[0];
}
