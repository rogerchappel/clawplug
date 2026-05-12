import { Type } from '@sinclair/typebox';
import { describe, expect, it } from 'vitest';
import { definePlugin, formatResult, wrapResult } from '../src/index.js';

describe('definePlugin — sectioned config', () => {
  it('creates a typed plugin entry with named sections', () => {
    const createEntry = definePlugin({
      id: 'sectioned-demo',
      name: 'Sectioned Demo',
      description: 'Uses named sections.',
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
    expect(entry.id).toBe('sectioned-demo');
    expect(entry.tools[0]?.name).toBe('echo');
    // configSchema should be section-style as-is
    expect(entry.configSchema).toHaveProperty('auth');
  });
});

describe('definePlugin — flat config', () => {
  it('creates a typed plugin entry with a single Type.Object', () => {
    const createEntry = definePlugin({
      id: 'flat-demo',
      name: 'Flat Demo',
      description: 'Uses flat config.',
      configSchema: {
        $flat: true,
        schema: Type.Object({
          host: Type.String(),
          port: Type.Number(),
        }),
      },
      tools: (tool) => [
        tool({
          name: 'ping',
          description: 'Ping the server.',
          parameters: Type.Object({ timeout: Type.Number() }),
          execute: (
            { timeout }: { timeout: number },
            cfg: { host: string; port: number },
          ) => `Pinged ${cfg.host}:${cfg.port} (timeout ${timeout}ms)`,
        }),
      ],
    });

    const entry = createEntry();
    expect(entry.id).toBe('flat-demo');
    expect(entry.tools[0]?.name).toBe('ping');
    // configSchema should be normalised to _default section
    expect(entry.configSchema).toHaveProperty('_default');
  });
});

describe('formatResult', () => {
  it('wraps strings as-is', () => {
    expect(formatResult('hello').content[0]?.text).toBe('hello');
  });

  it('stringifies objects with indent', () => {
    const result = formatResult({ ok: true, n: 42 });
    expect(result.content[0]?.text).toContain('"ok"');
  });

  it('wrapResult is a deprecated alias', () => {
    expect(wrapResult('hi')).toEqual(formatResult('hi'));
  });
});

describe('register + lifecycle hooks', () => {
  it('hooks fire in the correct order', async () => {
    const order: string[] = [];
    const createEntry = definePlugin({
      id: 'hooked',
      name: 'Hooked Plugin',
      description: 'Tests lifecycle hooks.',
      configSchema: {},
      hooks: {
        onLoad: () => order.push('onLoad'),
        onToolCall: (name) => order.push(`onToolCall:${name}`),
        onError: () => order.push('onError'),
      },
      tools: (tool) => [
        tool({
          name: 'greet',
          description: 'Say hi.',
          parameters: Type.Object({}),
          execute: () => { order.push('execute'); return 'hi'; },
        }),
        tool({
          name: 'fail',
          description: 'Always throws.',
          parameters: Type.Object({}),
          execute: (): string => { throw new Error('boom'); },
        }),
      ],
    });

    const entry = createEntry();
    entry.hooks.onLoad?.({});
    expect(order).toEqual(['onLoad']);

    // Register tool
    const registered: Record<string, (p: unknown) => Promise<unknown>> = {};
    await entry.register(
      { registerTool: (t) => (registered[t.name] = async (p) => t.execute(p, {})) },
      {},
    );

    // Call succeed
    const result = await registered.greet({});
    expect(order).toContain('onToolCall:greet');
    expect(order).toContain('execute');
    expect((result as any).content[0]?.text).toBe('hi');

    // Call fail
    order.length = 0;
    await expect(registered.fail({})).rejects.toThrow('boom');
    expect(order).toEqual(['onToolCall:fail', 'onError']);
  });
});
