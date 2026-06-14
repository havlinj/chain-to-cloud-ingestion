import { readFileSync } from "fs";
import { join, resolve } from "path";
import { describe, expect, it } from "vitest";

import { voteCommitment } from "./commitment.js";

const FIXTURES_DIR = resolve(import.meta.dirname, "../../../smart-contract/tests/fixtures");

describe("voteCommitment", () => {
  it("matches golden commitment fixture (ADR 0003)", () => {
    const golden = JSON.parse(
      readFileSync(join(FIXTURES_DIR, "golden-0003-vote-commitment-expected.json"), "utf8")
    ) as {
      proposal_id: string;
      option_id: string;
      salt_hex: string;
      voter_pubkey_hex: string;
      sha256_hex: string;
    };
    const digest = voteCommitment(
      golden.proposal_id,
      Buffer.from(golden.salt_hex, "hex"),
      Buffer.from(golden.voter_pubkey_hex, "hex"),
      golden.option_id
    );
    expect(Buffer.from(digest).toString("hex")).toBe(golden.sha256_hex);
  });

  it("rejects salt that is not 32 bytes", () => {
    const voter = Buffer.alloc(32);
    expect(() => voteCommitment("prop-1", new Uint8Array(16), voter, "1")).toThrow(
      /salt and voter pubkey must be 32 bytes/
    );
  });

  it("rejects voter pubkey that is not 32 bytes", () => {
    const salt = Buffer.alloc(32);
    expect(() => voteCommitment("prop-1", salt, new Uint8Array(16), "1")).toThrow(
      /salt and voter pubkey must be 32 bytes/
    );
  });
});
