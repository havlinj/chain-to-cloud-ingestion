export async function waitUntilUnix(targetUnix: number, label: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const delaySeconds = targetUnix - now;
  if (delaySeconds <= 0) {
    return;
  }
  console.log(`waiting ${delaySeconds}s for ${label} (until unix ${targetUnix})...`);
  await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
  // Small buffer so on-chain clock checks pass after boundary.
  await new Promise((resolve) => setTimeout(resolve, 2000));
}
