# clawplug

OpenClaw plugin SDK for typed plugin tools, config, lifecycle hooks, and testing.

## Development

```sh
npm install
npm test
npm run build
npm run release:check
```

## Contributing

Small, focused pull requests are preferred. Run `npm run release:check` before shipping changes.

## Security

If you find a vulnerability, follow [SECURITY.md](SECURITY.md).

## Development

Run the same checks locally before opening a change:

```sh
npm ci
npm run check
npm run build
npm test
npm run package:smoke
npm run release:check
```
