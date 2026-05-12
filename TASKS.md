# TASKS — V1 Clawplug SDK

Follow `orchestration.md` and the [architecture docs](ARCHITECTURE.md) alongside this tasks file. Tasks may be done in parallel by agents unless marked `sequential`.

**Status key:** `[ ]` todo | `[/]` in progress | `[x]` done

---

## Phase 1: Core Plugin API (`src/index.ts`)

[ ] 1.1 **`definePlugin()` entry point**
- Accepts: `id`, `name`, `description`, `configSchema` (TypeBox schema or named-sections object), `tools` (callback factory), `hooks` (optional)
- Returns a factory function `createEntry()` that produces a plugin entry compatible with OpenClaw's adapter interface
- Generic type inference: `TConfig` derived from `configSchema`, per-tool `TSchema` derived from parameters
- Use the tRPC-style callback pattern: `tools: (tool) => [tool({ ... })]` so TConfig is fixed at definePlugin time and TSchema is inferred per tool

[ ] 1.2 **TypeBox config schema support**
- Accept a single Type.Object schema directly (flat config)
- Accept a record of named section schemas: `{ auth: Type.Object({...}), connection: Type.Object({...}) }`
- Flatten sections into a single config object at runtime for `execute()` calls
- Preserve section metadata for manifest generation and settings UI

[ ] 1.3 **Tool factory + result wrapping**
- `tool()` is identity at runtime — all type magic is compile-time
- `register()` collects tool definitions, wrapping each `execute()` to call `formatResult()`
- `formatResult()` transforms plain objects into OpenClaw protocol format: `{ content: [{ type: "text", text: JSON.stringify(result) }] }`

[ ] 1.4 **Plugin lifecycle hooks**
- `onLoad(config)`: called once when plugin is loaded — validate connectivity, warm caches
- `onToolCall(toolName, params, config)`: intercept before execution — logging, rate limiting, auth checks
- `onError(toolName, error)`: catch errors from execute — logging, retries, graceful degradation
- Hooks run before tool execution; if `onToolCall` throws, the tool does not execute

---

## Phase 2: Build-time Generator (`src/generate-cli.ts`)

[ ] 2.1 **Generator entry point**
- `carapace-generate-cli --entry <plugin.js> --out <bin-dir>`
- Imports compiled `plugin.js`, calls `createEntry()`
- Reads metadata: `id`, `name`, `description`, `configSchema`, `hooks`, `contracts`
- Emits: `adapter.js`, `bin/<id>.js`, `openclaw.plugin.json`

[ ] 2.2 **Adapter generation (`adapter.js`)**
- Imports `createAdapter` from the SDK
- Wraps `createEntry()` with `createAdapter(createEntry(), import.meta.url)`
- Optional OpenClaw peer dependency handling: if found, wraps with `definePluginEntry()`; if not, returns raw entry

[ ] 2.3 **CLI generation (`bin/<id>.js`)**
- Imports `run` from `clawplug/cli`
- Calls `run(createEntry(), { binName, envPrefix })`
- `envPrefix` derived from plugin id: `my-plugin` → `MY_PLUGIN`

[ ] 2.4 **Manifest generation (`openclaw.plugin.json`)**
- Fields: `id`, `name`, `description`, `version` (from package.json), `contracts.tools`, `configSchema` (as JSON Schema), `hooks` (declared hook names)
- Written to repo root (not dist/) — gitignored, regenerated every build

---

## Phase 3: CLI Runtime (`src/cli.ts`)

[ ] 3.1 **Command dispatch**
- Calls `register()` with mock API to collect tool definitions
- Reads env vars → builds pluginConfig from configSchema properties
- Matches CLI command string to tools: exact match, hyphen/underscore normalization, suffix match, singleton fallback
- Parses positional args and `--flag` / `--flag=value` syntax

[ ] 3.2 **Config-to-env-var mapping**
- `<PLUGIN_ID_SCREAMING_SNAKE>_<FIELD_SCREAMING_SNAKE>` for flat schemas
- `<PLUGIN_ID>_<SECTION>_<FIELD>` for named-section schemas
- Numeric fields coerced via `Number(val)`

[ ] 3.3 **`--json` output flag**
- Without flag: human-readable output
- With flag: raw JSON of the result object

[ ] 3.4 **Array-typed parameters**
- Parameters typed as arrays consume all remaining positional args

---

## Phase 4: `clawplug dev` (Watch Mode)

[ ] 4.1 **Dev command**
- `clawplug dev` watches `src/` for changes
- On change: re-run tsup, then `clawplug-generate-cli`
- Debounce to avoid double-regeneration

---

## Phase 5: `clawplug validate`

[ ] 5.1 **Publication readiness checker**
- Verifies: all exports present, manifest generated, TypeScript strict mode passes, no stray generated files in repo
- Reports issues in a checklist format

---

## Phase 6: Testing Utilities (`src/test.ts`)

[ ] 6.1 **`testPlugin()` helper**
- Accepts `createEntry` and mock config
- Returns `{ tools }` object for direct invocation without a gateway
- Supports section-aware config: `{ auth: { apiKey: "test" }, connection: {} }`

---

## Phase 7: Shared Configs

[ ] 7.1 **`tsconfig.base.json`**
- Extendable base config for plugin projects

[ ] 7.2 **`tsup` preset (`src/tsup.ts`)**
- `definePluginConfig()` returns standard tsup settings
- Default entry: `["src/plugin.ts"]`

[ ] 7.3 **Shared `.gitignore`**
- Ignores `dist/`, `openclaw.plugin.json`, `node_modules/`

---

## Phase 8: Reusable GitHub Actions

[ ] 8.1 **`plugin-ci.yml`**
- Runs on push: `npm ci` → `npm run build` → `npm test` → validate manifest
- Single job, no composite runs

[ ] 8.2 **`plugin-release.yml`**
- Triggered by `workflow_dispatch` with `version-bump` (patch/minor/major) and `prerelease` (alpha/beta/rc)
- Runs CI first, then bumps version, commits + tags, publishes to npm, creates draft GitHub release
- Pre-release labels use npm dist-tags

---

## Phase 9: Architecture Documentation

[ ] 9.1 **Write `ARCHITECTURE.md`**
- Type machinery behind `definePlugin()`
- Config section flattening
- Plugin lifecycle hook execution order and error propagation
- How `clawplug-generate-cli` inspects compiled plugins
- CLI runtime and subcommand dispatch
- Adapter pattern for OpenClaw integration
- Result wrapping
- `@clawplug/test` mock-gateway-free testing
- `clawplug dev` watch mode file dependency graph

---

## Acceptance Criteria

- `npm test` passes
- `npm run build` succeeds
- `npm pack` produces valid tarball
- TypeScript strict mode: no errors
- CLI help output is correct
- `git diff --check` passes
- Markdown renders cleanly on GitHub
- MIT license present
