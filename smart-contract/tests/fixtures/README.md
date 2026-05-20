# Golden fixtures (ADR 0001, 0003)

Reference **inputs** and **expected outputs** for tests and for matching admin tooling / on-chain verifiers. Specs: `docs/ADR/0001-*.md`, `docs/ADR/0003-*.md`.

## Files

| File | Role | Used for |
|------|------|----------|
| `golden-0001-voter-list-input.txt` | **Input sample** | Example of the canonical off-chain voter list (what admin publishes); same format as production `list_hash` input |
| `golden-0001-list-hash-and-merkle-expected.json` | **Expected output** | After processing that `.txt` per ADR 0001: `list_hash`, Merkle leaves, Merkle root |
| `golden-0003-vote-commitment-expected.json` | **Expected output** | One commit–reveal scenario: SHA-256 commitment digest + base58 (ADR 0003) |

**Flow (0001):** read `golden-0001-voter-list-input.txt` → compute hashes like admin tooling → assert equals `golden-0001-list-hash-and-merkle-expected.json`.

**Flow (0003):** build commitment from fields in `golden-0003-vote-commitment-expected.json` → assert hash matches `sha256_hex` / `commitment_base58`.

Test pubkeys are deterministic `0x00…01`–`03` (base58 `111111…12`–`14`); not devnet wallets.

## Regenerate

```bash
cd smart-contract
python3 -m venv .venv-fixtures
.venv-fixtures/bin/pip install pycryptodome
.venv-fixtures/bin/python scripts/generate_golden_fixtures.py
```

Update ADR test-vector lines if hash values change.
