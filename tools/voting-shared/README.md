# voting-shared

Shared TypeScript helpers for voting admin tools (`eligibility-admin`, `devnet-pipeline`).

Matches on-chain `voting-crypto` and ADRs **0001** (Merkle electorate) and **0003** (commitment hash).

Exports include `verifyMerkleProof` for proof validation at commit time.

## Modules

| Export       | Purpose                                          |
| ------------ | ------------------------------------------------ |
| `merkle`     | `merkleLeaf`, `merkleRoot`, `buildMerkleProof`   |
| `commitment` | `voteCommitment`                                 |
| `bytes`      | `bytesToArray32`, `parseBytes32`                 |
| `electorate` | voter list parse/build, `merkleProofForVoter`    |
| `pda`        | program PDAs (registry, proposal, commitment, …) |

## Usage

```typescript
import { buildElectorateFromFile, voteCommitment, proposalPda } from "voting-shared";
```

Local dependency in tool `package.json`:

```json
"voting-shared": "file:../voting-shared"
```

## Tests

```bash
cd tools/voting-shared
npm install
npm test
```

Golden fixtures: `smart-contract/tests/fixtures/`.
