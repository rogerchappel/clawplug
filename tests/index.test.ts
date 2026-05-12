import { Type } from '@sinclair/typebox';
import { describe, expect, it } from 'vitest';
import { definePlugin, wrapResult } from '../src/index.js';

describe('definePlugin', () => {
  it('creates a typed plugin entry and wraps plain results', () => {
    const createEntry = definePlugin({
      id: 'demo',
      name: 'Demo',
      description: 'Demo plugin.',
      configSchema: { auth: Type.Object({ apiKey: Type.String() }) },
      tools: (tool) => [
        tool({
          name: 'echo',
          description: 'Echo input.',
          parameters: Type.Object({ input: Type.String() }),
          execute: ({ input }: { input: string }) => ({ input }),
        }),
      ],
    });

    const entry = createEntry();
    expect(entry.tools[0]?.name).toBe('echo');
    expect(wrapResult({ ok: true }).content[0]?.text).toContain('ok');
  });
});
