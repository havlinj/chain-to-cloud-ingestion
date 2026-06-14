import { describe, expect, it } from "vitest";

import { parseProgramLogs } from "./log-parser.js";

describe("parseProgramLogs", () => {
  it("returns empty array when no Anchor events are present", () => {
    const events = parseProgramLogs(
      ["Program BbnG5ScQxQrvZVq5FiDEgH7zx8dK6qH9jN3DEUmJSiuc invoke [1]"],
      1,
      "sig"
    );
    expect(events).toEqual([]);
  });
});
