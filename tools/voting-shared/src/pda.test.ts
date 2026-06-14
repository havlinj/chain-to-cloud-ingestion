import { PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";

import {
  commitmentPda,
  grantedVoterPda,
  programConfigPda,
  proposalPda,
  revokedVoterPda,
  voterRegistryPda,
} from "./pda.js";

/** Snapshot addresses for PROGRAM_ID + inputs below (Solana findProgramAddressSync). */
const PROGRAM_ID = new PublicKey("BbnG5ScQxQrvZVq5FiDEgH7zx8dK6qH9jN3DEUmJSiuc");
const VOTER = new PublicKey("11111111111111111111111111111112");
const PROPOSAL_ID = "pipeline-test-1";

const GOLDEN_PDAS = {
  voterRegistry: "5Hdxbw1DDq7TBW1mbt4Fin9d4htmEhFhbEi6ePVkpGxT",
  programConfig: "YDN3LYsY3dqpSeKaatV5fwrHfy6xXfqWwFNCFUshABk",
  proposal: "12M9BpksbGCdBYHbDmeJS4z5pAJwHec75RoYTcV5fs4A",
  commitment: "Bp4NRnNweu2py2aLtZXZx6VERuv9p6j8eWRKBTEDkBhK",
  granted: "8u1dZaj5aiJVx4L1HXf5Cxj1MFAGz4zMMi6p11XoLDDS",
  revoked: "CyoUFXXmkkeVZwX2yKtWDogtzmwFzVJp2Ae4jGtcmeU8",
} as const;

describe("voterRegistryPda", () => {
  it("matches golden voter_registry address", () => {
    expect(voterRegistryPda(PROGRAM_ID).toBase58()).toBe(GOLDEN_PDAS.voterRegistry);
  });
});

describe("programConfigPda", () => {
  it("matches golden program_config address", () => {
    expect(programConfigPda(PROGRAM_ID).toBase58()).toBe(GOLDEN_PDAS.programConfig);
  });
});

describe("proposalPda", () => {
  it("matches golden proposal address for pipeline-test-1", () => {
    expect(proposalPda(PROGRAM_ID, PROPOSAL_ID).toBase58()).toBe(GOLDEN_PDAS.proposal);
  });
});

describe("commitmentPda", () => {
  it("matches golden commitment address for proposal and voter", () => {
    const proposal = proposalPda(PROGRAM_ID, PROPOSAL_ID);
    expect(commitmentPda(PROGRAM_ID, proposal, VOTER).toBase58()).toBe(GOLDEN_PDAS.commitment);
  });
});

describe("grantedVoterPda", () => {
  it("matches golden granted voter address", () => {
    expect(grantedVoterPda(PROGRAM_ID, VOTER).toBase58()).toBe(GOLDEN_PDAS.granted);
  });
});

describe("revokedVoterPda", () => {
  it("matches golden revoked voter address", () => {
    expect(revokedVoterPda(PROGRAM_ID, VOTER).toBase58()).toBe(GOLDEN_PDAS.revoked);
  });
});
