# clawplug

OpenClaw plugin SDK for typed plugin tools, config schemas, lifecycle hooks, and
test helpers.

Use `clawplug` when you want a plugin entry point that can be registered by an
OpenClaw host while keeping tool parameters and plugin config typed in source.

## Install

```sh
npm install clawplug @sinclair/typebox
```

`clawplug` targets Node.js 20 and newer.

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

## Test Helpers

Use `testPlugin` from `clawplug/test` to exercise tools without a full host:

```ts
import { testPlugin } from "clawplug/test";
import createEntry from "./plugin.js";

const { tools } = testPlugin(createEntry, { auth: { apiKey: "test" } });
await tools.hello({ name: "Ada" });
```

## Development

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

## Security

If you find a vulnerability, follow [SECURITY.md](SECURITY.md).

## Contributing

Small, focused pull requests are preferred. Include the verification commands
you ran in the PR body.
