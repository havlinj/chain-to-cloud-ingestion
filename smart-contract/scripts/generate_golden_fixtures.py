#!/usr/bin/env python3
"""Regenerate ADR golden fixtures under tests/fixtures/."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "tests" / "fixtures"

# Names: role first — input sample vs expected outputs (see tests/fixtures/README.md)
VOTER_LIST_INPUT = "golden-0001-voter-list-input.txt"
ELECTORATE_EXPECTED = "golden-0001-list-hash-and-merkle-expected.json"
COMMITMENT_EXPECTED = "golden-0003-vote-commitment-expected.json"

ALPHABET = b"123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


def b58encode(data: bytes) -> str:
    n = int.from_bytes(data, "big")
    enc = bytearray()
    while n > 0:
        n, r = divmod(n, 58)
        enc.append(ALPHABET[r])
    pad = 0
    for b in data:
        if b == 0:
            pad += 1
        else:
            break
    return (ALPHABET[0:1] * pad + enc[::-1]).decode("ascii")


def keccak256(data: bytes) -> bytes:
    from Crypto.Hash import keccak

    k = keccak.new(digest_bits=256)
    k.update(data)
    return k.digest()


def merkle_root(leaf_hashes: list[bytes]) -> bytes:
    level = leaf_hashes[:]
    while len(level) > 1:
        next_level = []
        for i in range(0, len(level), 2):
            left = level[i]
            right = level[i + 1] if i + 1 < len(level) else level[i]
            if right < left:
                left, right = right, left
            next_level.append(keccak256(left + right))
        level = next_level
    return level[0]


def main() -> None:
    pubkey_bytes = [
        bytes.fromhex("0000000000000000000000000000000000000000000000000000000000000001"),
        bytes.fromhex("0000000000000000000000000000000000000000000000000000000000000002"),
        bytes.fromhex("0000000000000000000000000000000000000000000000000000000000000003"),
    ]
    pubkeys_b58_sorted = sorted(b58encode(p) for p in pubkey_bytes)
    canonical_lines = "\n".join(pubkeys_b58_sorted)
    canonical_bytes = canonical_lines.encode("utf-8")
    list_hash = hashlib.sha256(canonical_bytes).hexdigest()

    pubkey_by_b58 = {b58encode(p): p for p in pubkey_bytes}
    ordered_bytes = [pubkey_by_b58[b] for b in pubkeys_b58_sorted]
    leaves = [keccak256(p) for p in ordered_bytes]
    root = merkle_root(leaves)

    FIXTURES.mkdir(parents=True, exist_ok=True)
    (FIXTURES / VOTER_LIST_INPUT).write_text(canonical_lines, encoding="utf-8")

    electorate = {
        "role": "expected_output",
        "adr": "0001-electorate-enumeration-canonical-list",
        "description": "Expected list_hash and Merkle root after processing golden-0001-voter-list-input.txt per ADR 0001.",
        "input_file": VOTER_LIST_INPUT,
        "pubkeys_base58_sorted": pubkeys_b58_sorted,
        "pubkeys_hex": [p.hex() for p in ordered_bytes],
        "canonical_list_utf8": canonical_lines,
        "list_hash_sha256_hex": list_hash,
        "merkle_leaf_rule": "keccak256(32-byte pubkey)",
        "merkle_leaves_keccak256_hex": [x.hex() for x in leaves],
        "merkle_pair_rule": "keccak256(min(left,right) || max(left,right)); odd level duplicates last node",
        "merkle_root_keccak256_hex": root.hex(),
        "merkle_root_base58": b58encode(root),
    }
    (FIXTURES / ELECTORATE_EXPECTED).write_text(
        json.dumps(electorate, indent=2) + "\n", encoding="utf-8"
    )

    proposal_id = "proposal-golden-001"
    option_id = "1"
    salt = bytes.fromhex(
        "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"
    )
    voter = pubkey_bytes[0]
    commitment_input = (
        proposal_id.encode("utf-8") + salt + voter + option_id.encode("utf-8")
    )
    commitment = hashlib.sha256(commitment_input).digest()

    commitment_golden = {
        "role": "expected_output",
        "adr": "0003-commit-reveal-voting",
        "description": "Expected vote commitment for one fixed voter/input scenario per ADR 0003.",
        "proposal_id": proposal_id,
        "option_id": option_id,
        "salt_hex": salt.hex(),
        "voter_pubkey_base58": b58encode(voter),
        "voter_pubkey_hex": voter.hex(),
        "concat_order": "proposal_id_utf8 || salt_32 || voter_pubkey_32 || option_id_utf8",
        "sha256_hex": commitment.hex(),
        "commitment_base58": b58encode(commitment),
    }
    (FIXTURES / COMMITMENT_EXPECTED).write_text(
        json.dumps(commitment_golden, indent=2) + "\n", encoding="utf-8"
    )

    for obsolete in (
        "canonical-electorate-list.txt",
        "electorate-golden.json",
        "commitment-golden.json",
    ):
        path = FIXTURES / obsolete
        if path.exists():
            path.unlink()

    print("Wrote fixtures to", FIXTURES)


if __name__ == "__main__":
    main()
