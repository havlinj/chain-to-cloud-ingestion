import { PublicKey } from "@solana/web3.js";

export function bytesToArray32(bytes: Uint8Array): number[] {
  if (bytes.length !== 32) {
    throw new Error("expected 32 bytes");
  }
  return Array.from(bytes);
}

export function parseBytes32(input: string, label: string): Uint8Array {
  const trimmed = input.trim();
  try {
    return new PublicKey(trimmed).toBytes();
  } catch {
    const hex = trimmed.startsWith("0x") ? trimmed.slice(2) : trimmed;
    const buf = Buffer.from(hex, "hex");
    if (buf.length !== 32) {
      throw new Error(`${label}: expected 32 bytes (hex or base58)`);
    }
    return new Uint8Array(buf);
  }
}
