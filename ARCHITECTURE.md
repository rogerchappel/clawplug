# Clawplug architecture

Clawplug is a small TypeScript SDK for defining OpenClaw-compatible plugin
entries. The main implementation lives in `src/index.ts`; the test helper is
`src/test.ts`. This guide describes the behavior implemented by the current
source, rather than the broader planned scope in `TASKS.md`.

## Definition and types

`definePlugin()` accepts a plugin definition and returns a `createEntry()`
factory. The config schema type is retained by the factory so TypeBox `Static`
types flow into lifecycle hooks and each tool's `execute(params, config)`.
`tools` is a callback receiving an identity `tool()` helper. This callback
pattern keeps config inference fixed by the plugin while inferring each
parameter type from its own tool definition.

Config can be a record of named TypeBox schemas, such as `auth` and
`connection`, or a flat wrapper of the form
`{ $flat: true, schema: Type.Object(...) }`. Named sections are retained as
provided. A flat schema is normalized to a single `_default` section in the
entry's `configSchema`; the SDK does not flatten named-section values into one
object at runtime. The host supplies the config object when registering tools.

## Registration and lifecycle

Call `createEntry()` to create an entry, then call its asynchronous `register`
method with a host API (`registerTool`) and the validated config. Registration
first awaits `onLoad(config)` once, then registers every declared tool. Each
registered tool captures that config, so its host-facing `execute` accepts
parameters only.

For each invocation, `onToolCall(toolName, params, config)` runs before the
execution error-handling block. If it rejects, execution is prevented and
`onError` is not called. The tool's `execute(params, config)` is awaited; if it
throws or rejects, `onError(toolName, error, config)` is awaited and the
original error is rethrown. A failure in `onError` itself propagates instead.
Successful results are passed through `formatResult()`.

## Result protocol

`formatResult(value)` returns `{ content: [{ type: "text", text }] }`. Strings
are used as-is; other values are pretty-printed with `JSON.stringify`. If
serialization yields no text or throws, the function falls back to `String`;
if even that conversion throws, it returns `[unserializable value]`. The
`wrapResult` export is a deprecated alias retained for compatibility.

## Testing without a gateway

`testPlugin(createEntry, config)` in `src/test.ts` creates an entry, awaits its
`onLoad` hook, and returns `{ entry, tools }`. The `tools` object maps tool
names to async functions that apply `onToolCall`, execute the tool with the
provided config, format results, and route execution errors to `onError`.
This provides direct invocation in tests without constructing a gateway.

## Package and build

The package exposes the built main module and `clawplug/test` helper through
`package.json`. `tsup` builds the TypeScript source; `npm run typecheck` checks
strict TypeScript compilation, and Vitest runs the tests. `npm run
package:smoke` exercises the packed package, while `npm run release:check`
combines typecheck, tests, and that package smoke check. The checked-in CI
workflow runs the release check on pull requests and pushes to `main`.

## Other repository tooling

The current repository has a source-level API and test helper. A generator,
CLI runtime, adapter integration, and watch mode appear as planned items in
`TASKS.md`; they are not implemented by the current `src/` files and this
document does not describe them as available behavior.
