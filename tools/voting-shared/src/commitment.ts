import { createHash } from "crypto";

/** SHA-256 vote commitment (ADR 0003), matches `voting-crypto::vote_commitment`. */
export function voteCommitment(
  proposalId: string,
  salt: Uint8Array,
  voterPubkey: Uint8Array,
  optionId: string
): Uint8Array {
  if (salt.length !== 32 || voterPubkey.length !== 32) {
    throw new Error("salt and voter pubkey must be 32 bytes");
  }
  return createHash("sha256")
    .update(Buffer.from(proposalId, "utf8"))
    .update(salt)
    .update(voterPubkey)
    .update(Buffer.from(optionId, "utf8"))
    .digest();
}
