# Changelog

## Next

- Removed `@sinclair/typebox` from runtime dependencies; it is used only as a
  compile-time type dependency (still a devDependency and documented as a
  consumer-side install).
- Refreshed the development dependency lockfile to resolve audited `nanoid` and
  `postcss` vulnerabilities without changing the package manifest ranges.
- Documented SDK limitations around host responsibilities, credential handling,
  network access, and in-process test helper coverage.

## 0.1.0

- Initial OpenClaw plugin SDK for typed tool definitions, plugin metadata, lifecycle hooks, and test helpers.
- Added local release validation with type checking, tests, build output, and npm package dry-run coverage.
- Documented contribution and security expectations for local-first plugin development.
