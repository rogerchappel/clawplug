# Release Readiness

Use this checklist before publishing, tagging, or asking reviewers to trust the package surface.

## Package Surface

- Package: `clawplug`
- Repository: `https://github.com/rogerchappel/clawplug`
- Pack contents are constrained by the `files` allowlist in `package.json`.

## CLI Surface

- No CLI bin is published by this package.

## Verification Commands

- `npm run check`: `tsc --noEmit`
- `npm run typecheck`: `tsc --noEmit`
- `npm run test`: `vitest run`
- `npm run build`: `tsup`
- `npm run package:smoke`: `npm pack --dry-run`
- `npm run release:check`: `npm run check && npm test && npm run build && npm run package:smoke`

Run `npm run release:check` before opening a release PR. Record any skipped command and the reason in the PR body.

## Reviewer Notes

- Compare README examples with the current CLI bins or module exports.
- Inspect `npm pack --dry-run` output for generated logs, caches, or private fixtures.
- Confirm CI exercises the same release check path used locally.
