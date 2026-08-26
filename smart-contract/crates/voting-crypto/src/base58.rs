/// Decode a Solana-style base58 public key to 32 bytes.
pub fn decode_pubkey(input: &str) -> Result<[u8; 32], bs58::decode::Error> {
    let bytes = bs58::decode(input).into_vec()?;
    if bytes.len() != 32 {
        return Err(bs58::decode::Error::BufferTooSmall);
    }
    let mut out = [0u8; 32];
    out.copy_from_slice(&bytes);
    Ok(out)
}

/// Encode 32 bytes as base58 (e.g. commitment digest in events).
pub fn encode_base58(bytes: &[u8]) -> String {
    bs58::encode(bytes).into_string()
}
