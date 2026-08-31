import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = resolve(fileURLToPath(new URL('..', import.meta.url)));
const consumer = mkdtempSync(join(tmpdir(), 'clawplug-package-smoke-'));
let tarball;

try {
  execFileSync('npm', ['run', 'build'], { cwd: repository, stdio: 'inherit' });
  const packOutput = execFileSync('npm', ['pack', '--json'], {
    cwd: repository,
    encoding: 'utf8',
  });
  const [{ filename }] = JSON.parse(packOutput);
  tarball = join(repository, filename);

  writeFileSync(join(consumer, 'package.json'), JSON.stringify({
    private: true,
    type: 'module',
  }));
  execFileSync('npm', [
    'install', '--ignore-scripts', '--no-audit', '--no-fund', tarball,
    '@sinclair/typebox',
  ], { cwd: consumer, stdio: 'inherit' });

  writeFileSync(join(consumer, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      noEmit: true,
      strict: true,
      target: 'ES2022',
    },
    include: ['consumer.ts'],
  }));
  writeFileSync(join(consumer, 'consumer.ts'), `
    import { Type } from '@sinclair/typebox';
    import { definePlugin } from 'clawplug';

    definePlugin({
      id: 'typed-consumer',
      name: 'Typed Consumer',
      description: 'Typechecks the installed public declarations.',
      configSchema: { auth: Type.Object({ token: Type.String() }) },
      tools: () => [],
    });
  `);
  execFileSync(join(repository, 'node_modules', '.bin', 'tsc'), ['--project', 'tsconfig.json'], {
    cwd: consumer,
    stdio: 'inherit',
  });

  const smoke = `
    import assert from 'node:assert/strict';
    import { definePlugin, formatResult } from 'clawplug';
    import { testPlugin } from 'clawplug/test';

    const rootUrl = import.meta.resolve('clawplug');
    const testUrl = import.meta.resolve('clawplug/test');
    assert.match(rootUrl, /node_modules\\/clawplug\\/dist\\/index\\.js$/);
    assert.match(testUrl, /node_modules\\/clawplug\\/dist\\/test\\.js$/);
    assert.equal(formatResult('installed').content[0].text, 'installed');

    const createEntry = definePlugin({
      id: 'package-smoke',
      name: 'Package Smoke',
      description: 'Exercises the installed test helper.',
      configSchema: {},
      tools: (tool) => [tool({
        name: 'ping',
        description: 'Return a package smoke result.',
        parameters: {},
        execute: () => 'pong',
      })],
    });
    const { tools } = await testPlugin(createEntry, {});
    assert.equal((await tools.ping({})).content[0].text, 'pong');
  `;
  execFileSync('node', ['--input-type=module', '--eval', smoke], {
    cwd: consumer,
    stdio: 'inherit',
  });
  assert.ok(filename.endsWith('.tgz'));
  console.log(`Verified installed package declarations and exports in ${consumer}`);
} finally {
  if (tarball) rmSync(tarball, { force: true });
  rmSync(consumer, { recursive: true, force: true });
}
