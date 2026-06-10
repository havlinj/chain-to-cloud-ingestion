import { describe, expect, it } from "vitest";

import { parseBytes32 } from "./chain.js";

const ROOT_HEX = "28ba380b3c6003d6d833999c98d92f7976556bd64d4101054d164a1e8deefe92";
const ROOT_BASE58 = "3jz13vUQLAiWzwsYXCgVVJm7yTWtgWAuUSu1UDpXT1tu";

describe("parseBytes32", () => {
  it("parses 32-byte hex with or without 0x prefix", () => {
    expect(Buffer.from(parseBytes32(ROOT_HEX, "root")).toString("hex")).toBe(ROOT_HEX);
    expect(Buffer.from(parseBytes32(`0x${ROOT_HEX}`, "root")).toString("hex")).toBe(ROOT_HEX);
  });

  it("parses 32-byte base58", () => {
    expect(parseBytes32(ROOT_BASE58, "root").length).toBe(32);
    expect(Buffer.from(parseBytes32(ROOT_BASE58, "root")).toString("hex")).toBe(ROOT_HEX);
  });

  it("rejects hex that is not exactly 32 bytes", () => {
    expect(() => parseBytes32("0102", "list-hash")).toThrow(/list-hash: expected 32 bytes/);
    expect(() => parseBytes32(`0x${"00".repeat(31)}`, "root")).toThrow(/root: expected 32 bytes/);
  });

  it("rejects values that are neither valid base58 nor 32-byte hex", () => {
    expect(() => parseBytes32("not-valid!!!", "merkle_root")).toThrow(
      /merkle_root: expected 32 bytes/
    );
  });
});
