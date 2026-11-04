import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const script = new URL('./check-node-engine.mjs', import.meta.url);

function check(version) {
  return spawnSync(process.execPath, [script.pathname], {
    encoding: 'utf8',
    env: { ...process.env, NODE_ENGINE_CHECK_VERSION: version },
  });
}

describe('check:node-engine', () => {
  it.each(['20.0.0', '22.12.0', '24.0.0'])('accepts supported Node %s', (version) => {
    expect(check(version).status).toBe(0);
  });

  it.each(['19.9.9', '25.0.0'])('rejects out-of-range Node %s', (version) => {
    expect(check(version).status).not.toBe(0);
  });

  it('rejects unsupported range syntax', () => {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import { readFile, writeFile } from 'node:fs/promises';
      const path = new URL('./package.json', import.meta.url);
      const pkg = JSON.parse(await readFile(path, 'utf8'));
      pkg.engines.node = '^20.0.0 || ^22.0.0';
      await writeFile(path, JSON.stringify(pkg));
      const { spawnSync } = await import('node:child_process');
      const check = spawnSync(process.execPath, ['./scripts/check-node-engine.mjs'], { encoding: 'utf8' });
      process.stdout.write(check.stderr);
      process.exit(check.status !== 0 && check.stderr.includes('Unsupported engines.node comparator') ? 0 : 1);
    `], { encoding: 'utf8' });
    expect(result.status).toBe(0);
  });
});
