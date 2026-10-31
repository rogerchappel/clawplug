import { readFile } from 'node:fs/promises';

const { engines = {} } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const range = engines.node;
if (!range) throw new Error('package.json must declare engines.node');

// Support the simple comparator ranges commonly used by this project without
// adding a runtime dependency solely for a CI check.
const runtimeVersion = process.env.NODE_ENGINE_CHECK_VERSION ?? process.versions.node;
const version = runtimeVersion.split('.').map(Number);
const comparators = range.trim().split(/\s+/);
const valid = comparators.every((comparator) => {
  const match = comparator.match(/^(>=|>|<=|<|=|\^|~)?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/);
  if (!match) throw new Error(`Unsupported engines.node comparator: ${comparator}`);
  const expected = [Number(match[2]), Number(match[3] ?? 0), Number(match[4] ?? 0)];
  const order = version[0] - expected[0] || version[1] - expected[1] || version[2] - expected[2];
  switch (match[1] ?? '=') {
    case '>=': return order >= 0;
    case '>': return order > 0;
    case '<=': return order <= 0;
    case '<': return order < 0;
    case '^': return order >= 0 && version[0] === expected[0];
    case '~': return order >= 0 && version[0] === expected[0] && version[1] === expected[1];
    default: return order === 0;
  }
});
if (!valid) {
  console.error(`Node v${runtimeVersion} does not satisfy package.json engines.node (${range})`);
  process.exit(1);
}
console.log(`Node v${runtimeVersion} satisfies engines.node (${range})`);
