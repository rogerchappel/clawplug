# Orchestration — Clawplug SDK

## How to Work Through Tasks

When you pick up `TASKS.md`:

1. **Read this file first** — understand constraints before touching code
2. **Scan `TASKS.md`** — find the first unchecked `[ ]` task
3. **Work one phase at a time** — complete all tasks in a phase before moving forward
4. **Commit after each phase** — atomic commits, one phase per commit
5. **Run `npm test` and `npm run build` after each phase** — if either fails, fix before committing

## Constraints

- **TypeScript strict mode** — no `any`, no `@ts-ignore`, no `@ts-expect-error` without explanation
- **MIT license** — don't change it
- **No generated files in git** — `dist/`, `openclaw.plugin.json` must stay in `.gitignore`
- **Peer dependencies** — OpenClaw is an optional peer dependency. The SDK works standalone for plugin development and testing.
- **TypeBox schemas** — all config and parameter schemas use `@sinclair/typebox`. No Zod, no Yup, no other schema libraries.
- **Named exports only** — the main entry must export named functions: `definePlugin`, `formatResult`, `createAdapter`

## Phase Dependencies

- Phase 1 (Core API) must be complete before Phase 2, 3, 6
- Phase 2 (Generator) must be complete before Phase 3 (CLI Runtime) and Phase 4 (Watch Mode)
- Phase 3 (CLI Runtime) must be complete before Phase 4 and 5
- Phase 5 (Validate) and Phase 6 (Testing) can be done in parallel after Phase 1 and 2
- Phase 7 (Shared Configs) and Phase 8 (GitHub Actions) can be done anytime after Phase 1
- Phase 9 (Architecture) must be done last

## Testing Strategy

- Unit tests go in `tests/` with `.test.ts` suffix
- For Phase 1: test `definePlugin()` with flat and section schemas, verify type inference
- For Phase 3: test CLI command matching, env var mapping, array parameters
- For Phase 6: test `testPlugin()` with the example greet plugin

## Commit Convention

Use conventional commits: `feat: implement definePlugin()` `feat: add CLI runtime` `test: add plugin lifecycle tests` `docs: write ARCHITECTURE.md`

## PR Guidance

- Open a PR when the full V1 scope is complete
- Include in PR description: all phases completed, test count, build status
- Do not push directly to `main` if branch protection is enabled
