# TASKS — V1 Clawplug SDK

Follow `orchestration.md` and [ARCHITECTURE.md](ARCHITECTURE.md) when changing the SDK. This checklist describes the implemented V1 surface on `main`, not a roadmap of unimplemented generator, CLI, watch-mode, release, or reusable-workflow features. Do not treat unchecked entries here as committed product scope.

**Status key:** `[ ]` todo | `[/]` in progress | `[x]` done

## Implemented V1

- [x] `definePlugin()` returns a typed `createEntry()` factory; config and per-tool parameter types are inferred from TypeBox schemas.
- [x] Named-section config schemas and wrapped flat schemas (`{ $flat: true, schema }`) are supported. Flat schemas are normalized to `_default`; named config remains host-supplied.
- [x] Tool registration wraps results in the OpenClaw text-content format and captures the registered config.
- [x] Lifecycle hooks support load, pre-tool-call, and execution-error handling.
- [x] `testPlugin()` offers in-process helper coverage without a gateway.
- [x] `createAdapter()` provides host adapter integration.
- [x] Type checking, tests, build, and package smoke validation are available through the scripts below.

## Current verification commands

- `npm run typecheck` — TypeScript validation.
- `npm test` — unit tests.
- `npm run build` — ESM and declaration build for the currently exported SDK modules.
- `npm run package:smoke` — package contents and consumer smoke check.
- `npm run release:check` — combined check, tests, and package smoke; CI runs this on pull requests and pushes to `main`.

The `package.json` exports are currently `.` (`dist/index.js`) and `./test` (`dist/test.js`). There is no generator, CLI runtime, `clawplug dev`, publication-readiness command, shared config preset, or reusable release workflow in the package scripts or exports. These are not V1 deliverables; propose and scope such features separately before adding them to this checklist.
