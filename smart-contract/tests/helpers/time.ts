/** Wait until `unixTimestamp` (seconds) is reached on the local validator clock. */
export async function waitUntilUnix(unixTimestamp: number): Promise<void> {
  // Extra buffer: local validator clock can run slightly ahead of wall clock.
  const delayMs = unixTimestamp * 1000 - Date.now() + 1500;
  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}
