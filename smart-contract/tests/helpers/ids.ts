/** Solana PDA seeds are max 32 bytes per element; proposal_id is one seed. */
const MAX_PROPOSAL_ID_BYTES = 32;

let seq = 0;

export function uniqueProposalId(tag = ""): string {
  seq += 1;
  const core = `${Date.now().toString(36)}${seq.toString(36)}`;
  const id = tag ? `${tag}-${core}` : core;
  const bytes = Buffer.from(id, "utf8");
  if (bytes.length <= MAX_PROPOSAL_ID_BYTES) {
    return id;
  }
  return bytes.subarray(0, MAX_PROPOSAL_ID_BYTES).toString("utf8");
}
