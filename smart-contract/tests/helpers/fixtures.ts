import * as fs from "fs";
import * as path from "path";

const FIXTURES_DIR = path.join(process.cwd(), "tests", "fixtures");

export interface ElectorateGolden {
  canonical_list_utf8: string;
  list_hash_sha256_hex: string;
  pubkeys_hex: string[];
  merkle_leaves_keccak256_hex: string[];
  merkle_root_keccak256_hex: string;
  merkle_root_base58: string;
}

export interface CommitmentGolden {
  proposal_id: string;
  option_id: string;
  salt_hex: string;
  voter_pubkey_hex: string;
  sha256_hex: string;
  commitment_base58: string;
}

export function loadElectorateGolden(): ElectorateGolden {
  const raw = fs.readFileSync(
    path.join(FIXTURES_DIR, "golden-0001-list-hash-and-merkle-expected.json"),
    "utf8"
  );
  return JSON.parse(raw) as ElectorateGolden;
}

export function loadCommitmentGolden(): CommitmentGolden {
  const raw = fs.readFileSync(
    path.join(FIXTURES_DIR, "golden-0003-vote-commitment-expected.json"),
    "utf8"
  );
  return JSON.parse(raw) as CommitmentGolden;
}
