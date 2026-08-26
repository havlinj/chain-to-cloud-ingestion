# voting-shared

Shared TypeScript helpers for voting admin tools (`eligibility-admin`, `devnet-pipeline`).

Matches on-chain `voting-crypto` and ADRs **0001** (Merkle electorate) and **0003** (commitment hash).

Exports include `verifyMerkleProof` for proof validation at commit time.

Consumers import the **built** package (`dist/`), not TypeScript sources. Always run `npm run build` in this package after changing `src/` (and before typechecking or running dependent tools). There is no `prepare` hook: npm does not install this package's `devDependencies` when it is linked via `file:` from another package, so an automatic build on consumer `npm ci` would fail.

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

## Develop

```bash
cd tools/voting-shared
npm install
npm run build        # required — produces dist/ for consumers
npm test
npm run typecheck
```

Golden fixtures: `smart-contract/tests/fixtures/`.

Dependent tools (`eligibility-admin`, `devnet-pipeline`) need `dist/` present before their `tsc` / CLI runs. CI builds this package first via `scripts/ci/typescript.sh`.
