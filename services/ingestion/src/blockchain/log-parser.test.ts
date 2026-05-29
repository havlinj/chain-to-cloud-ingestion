import { describe, expect, it } from "vitest";

import { parseProgramLogs } from "./log-parser.js";

describe("parseProgramLogs", () => {
  it("returns empty array when no Anchor events are present", () => {
    const events = parseProgramLogs(
      ["Program VotiNG1111111111111111111111111111111111111 invoke [1]"],
      1,
      "sig",
    );
    expect(events).toEqual([]);
  });
});
