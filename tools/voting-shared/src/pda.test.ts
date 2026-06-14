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
const PROGRAM_ID = new PublicKey("VotiNG1111111111111111111111111111111111111");
const VOTER = new PublicKey("11111111111111111111111111111112");
const PROPOSAL_ID = "pipeline-test-1";

const GOLDEN_PDAS = {
  voterRegistry: "GqPfGvHiUnqnBwRnKbKGrfVhpB969P9wsTyAd8cR8krA",
  programConfig: "EXECnCYpKcf4LhyQeR9vfA3bR2jFiwcKouiDYHDhPcAF",
  proposal: "7AVmeXKPwy3dxeVnFvoiWt5Wto4CMJ9mR7xeJuLe7YcC",
  commitment: "8NkWZwop2iDAexhFSt8yMgsCRDyVaNNXHqJGJc1Frujw",
  granted: "DgRdn4YeDrJMPZBaMNh7WPooWJ8Xdvyq85SXkeD7vA7v",
  revoked: "8mcipH554vMXRvckYrxWF9QEDM9oqhwRxpEgDXmTEsnc",
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
