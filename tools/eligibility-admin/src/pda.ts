import { PublicKey } from "@solana/web3.js";

const SEED_VOTER_REGISTRY = Buffer.from("voter_registry");
const SEED_GRANTED = Buffer.from("granted");
const SEED_REVOKED = Buffer.from("revoked");

export function voterRegistryPda(programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([SEED_VOTER_REGISTRY], programId)[0];
}

export function grantedVoterPda(programId: PublicKey, voter: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([SEED_GRANTED, voter.toBuffer()], programId)[0];
}

export function revokedVoterPda(programId: PublicKey, voter: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([SEED_REVOKED, voter.toBuffer()], programId)[0];
}
