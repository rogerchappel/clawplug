# clawplug

OpenClaw plugin SDK for typed plugin tools, config schemas, lifecycle hooks, and
test helpers.

Use `clawplug` when you want a plugin entry point that can be registered by an
OpenClaw host while keeping tool parameters and plugin config typed in source.

## Install

```sh
npm install clawplug @sinclair/typebox
```

`clawplug` supports Node.js 20, 22, and 24 with npm 10. The repository pins
npm 10.9.4 so clean installs use the same verified lockfile implementation.

## Define a Plugin

```ts
import { Type } from "@sinclair/typebox";
import { definePlugin } from "clawplug";

export default definePlugin({
  id: "hello-plugin",
  name: "Hello Plugin",
  description: "Returns a greeting for a supplied name.",
  configSchema: {
    auth: Type.Object({
      apiKey: Type.String()
    })
  },
  hooks: {
    onToolCall: (toolName) => {
      console.log(`calling ${toolName}`);
    }
  },
  tools: (tool) => [
    tool({
      name: "hello",
      description: "Create a greeting.",
      parameters: Type.Object({
        name: Type.String()
      }),
      execute: ({ name }) => ({ message: `Hello, ${name}` })
    })
  ]
});
```

Tool return values are formatted as indented JSON. Values for which `JSON.stringify`
does not produce text use their string representation instead (for example,
`undefined` becomes `"undefined"` and `42n` becomes `"42"`).

Tool results are normalized to the OpenClaw content shape:

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"message\":\"Hello, Ada\"}"
    }
  ]
}
```

The same example is available as a copyable file at
[`examples/hello-plugin.ts`](examples/hello-plugin.ts).

## Config Shapes

`configSchema` supports named sections:

```ts
configSchema: {
  auth: Type.Object({ apiKey: Type.String() }),
  limits: Type.Object({ timeoutMs: Type.Number() })
}
```

It also supports a flat schema when a plugin only needs one config object:

```ts
configSchema: {
  $flat: true,
  schema: Type.Object({ host: Type.String(), port: Type.Number() })
}
```

Flat schemas are normalized to a `_default` section for host manifests.

## Host Registration

Pass the validated plugin config once when registering an entry. Registered
tools capture that config, so hosts invoke them with tool parameters only:

```ts
const entry = createEntry();
await entry.register(hostApi, { auth: { apiKey: process.env.API_KEY! } });
```

The captured config is used consistently by `onToolCall`, the tool's
`execute` function, and `onError`; callers cannot replace it per invocation.

## Test Helpers

Use `testPlugin` from `clawplug/test` to exercise tools without a full host:

```ts
import { testPlugin } from "clawplug/test";
import createEntry from "./plugin.js";

const { tools } = await testPlugin(createEntry, { auth: { apiKey: "test" } });
await tools.hello({ name: "Ada" });
```

## Development

Use Node.js 20, 22, or 24 and npm 10.9.4 (the version declared by
`packageManager`). Then install and verify from the lockfile:

```sh
npm ci
npm run check
npm test
npm run build
npm run package:smoke
npm run release:check
```

`npm run package:smoke` runs `npm pack --dry-run` so reviewers can confirm the
published package contains only the built output and public support files.

## Release Readiness

Before opening a release PR, run:

```sh
npm run release:check
```

The release gate type-checks source, runs the Vitest suite, builds `dist`, and
checks the dry-run package contents.

## Limitations

- `clawplug` defines SDK primitives and test helpers. It does not provide a
  standalone OpenClaw host, plugin registry, credential store, or deployment
  service.
- TypeBox schemas describe plugin config and tool parameters, but host
  applications are still responsible for validating secrets, enforcing
  permissions, and controlling network access.
- The test helper exercises plugin tools in process. It is useful for unit and
  fixture tests, not a replacement for an end-to-end host integration test.

## Security

If you find a vulnerability, follow [SECURITY.md](SECURITY.md).

## Contributing

Small, focused pull requests are preferred. Include the verification commands
you ran in the PR body.

## Release Verification

Before publishing or tagging a release, run the same verification path used by CI:

- `npm run release:check`
- `npm run package:smoke`

See `docs/release-readiness.md` for the package surface, CLI bins, and reviewer checklist.
