# Release Readiness

Use this checklist before publishing, tagging, or asking reviewers to trust the package surface.

## Package Surface

- Package: `clawplug`
- Repository: `https://github.com/rogerchappel/clawplug`
- Publication status: not yet published to the npm registry. Before the first
  release, consumers must install a tarball built from a verified checkout.
- Pack contents are constrained by the `files` allowlist in `package.json`.
- Copyable author examples under `examples/` are intentionally included in the
  published package.

## CLI Surface

- No CLI bin is published by this package.

## Verification Commands

- `npm run check`: `tsc --noEmit`
- `npm run typecheck`: `tsc --noEmit`
- `npm run test`: `vitest run`
- `npm run build`: `tsup`
- `npm run package:smoke`: build and pack a tarball, install it into an isolated
  temporary consumer, resolve and exercise `clawplug` and `clawplug/test` from
  that installed artifact, then remove the tarball and consumer.
- `npm run release:check`: `npm run check && npm test && npm run package:smoke`

Run `npm run release:check` before opening a release PR. Use npm 10.9.4 on each
supported Node.js release (20, 22, and 24), matching CI and the
`packageManager` declaration. Record any skipped command and the reason in the
PR body.

## Reviewer Notes

- Compare README examples with the current CLI bins or module exports.
- Inspect the package-smoke pack output for generated logs, caches, or private fixtures.
- Confirm installation guidance does not use the registry until `npm view
  clawplug version` returns the intended published release.
- Confirm CI exercises the same release check path used locally.
