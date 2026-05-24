import { AnchorError } from "@coral-xyz/anchor";
import { expect } from "chai";

/** Anchor program error code (e.g. `NotEligible`) when present. */
export function anchorErrorCode(err: unknown): string | undefined {
  if (err instanceof AnchorError) {
    return err.error.errorCode.code;
  }
  return undefined;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Assert an async RPC fails with the given Anchor error code or message fragment. */
export async function expectAnchorError(
  fn: () => Promise<unknown>,
  codeOrPattern: string | RegExp
): Promise<void> {
  try {
    await fn();
    expect.fail("expected transaction to fail");
  } catch (err: unknown) {
    const code = anchorErrorCode(err);
    const msg = errorMessage(err);
    if (typeof codeOrPattern === "string") {
      const ok = code === codeOrPattern || msg.includes(codeOrPattern);
      expect(ok, `expected ${codeOrPattern}, got code=${code} msg=${msg}`).to.be
        .true;
      return;
    }
    expect(msg).to.match(codeOrPattern);
    if (code) {
      expect(code).to.match(codeOrPattern);
    }
  }
}

export function expectLogsInclude(logs: string[], fragment: string): void {
  const needle = fragment.toLowerCase();
  const hit = logs.some((line) => line.toLowerCase().includes(needle));
  expect(hit, `expected logs to include "${fragment}"`).to.be.true;
}
