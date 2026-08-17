import { Type } from '@sinclair/typebox';
import { describe, expect, it } from 'vitest';
import { definePlugin, formatResult, wrapResult } from '../src/index.js';
import { testPlugin } from '../src/test.js';

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
  it('awaits hooks in the correct order', async () => {
    const order: string[] = [];
    const createEntry = definePlugin({
      id: 'hooked',
      name: 'Hooked Plugin',
      description: 'Tests lifecycle hooks.',
      configSchema: {},
      hooks: {
        onLoad: () => order.push('onLoad'),
        onToolCall: async (name) => {
          order.push(`onToolCall:${name}:start`);
          await Promise.resolve();
          order.push(`onToolCall:${name}:end`);
        },
        onError: async () => {
          order.push('onError:start');
          await Promise.resolve();
          order.push('onError:end');
        },
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
    // Register tool
    const registered: Record<string, (p: unknown) => Promise<unknown>> = {};
    await entry.register(
      { registerTool: (t) => (registered[t.name] = async (p) => t.execute(p, {})) },
      {},
    );
    expect(order).toEqual(['onLoad']);

    // Call succeed
    const result = await registered.greet({});
    expect(order).toEqual([
      'onLoad',
      'onToolCall:greet:start',
      'onToolCall:greet:end',
      'execute',
    ]);
    expect((result as any).content[0]?.text).toBe('hi');

    // Call fail
    order.length = 0;
    await expect(registered.fail({})).rejects.toThrow('boom');
    expect(order).toEqual([
      'onToolCall:fail:start',
      'onToolCall:fail:end',
      'onError:start',
      'onError:end',
    ]);
  });

  it('does not execute a tool when an async onToolCall hook rejects', async () => {
    const hookError = new Error('not authorized');
    let executed = false;
    let invoke: (() => Promise<unknown>) | undefined;
    const entry = definePlugin({
      id: 'guarded',
      name: 'Guarded Plugin',
      description: 'Tests rejected pre-call hooks.',
      configSchema: {},
      hooks: {
        onToolCall: async () => {
          await Promise.resolve();
          throw hookError;
        },
      },
      tools: (tool) => [
        tool({
          name: 'protected',
          description: 'Must not run.',
          parameters: Type.Object({}),
          execute: () => { executed = true; },
        }),
      ],
    })();

    await entry.register(
      { registerTool: (tool) => { invoke = async () => tool.execute({}, {}); } },
      {},
    );

    await expect(invoke?.()).rejects.toBe(hookError);
    expect(executed).toBe(false);
  });

  it('awaits async onLoad once across multiple tool calls', async () => {
    const order: string[] = [];
    const entry = definePlugin({
      id: 'async-load', name: 'Async load', description: 'Loads once.', configSchema: {},
      hooks: { onLoad: async () => { order.push('load:start'); await Promise.resolve(); order.push('load:end'); } },
      tools: (tool) => [tool({ name: 'run', description: 'Run.', parameters: Type.Object({}), execute: () => { order.push('execute'); return 'ok'; } })],
    })();
    let invoke: (() => Promise<unknown>) | undefined;
    await entry.register({ registerTool: (tool) => { invoke = () => tool.execute({}, {}) as Promise<unknown>; } }, {});

    await invoke?.();
    await invoke?.();
    expect(order).toEqual(['load:start', 'load:end', 'execute', 'execute']);
  });

  it('propagates rejected onLoad without executing tools', async () => {
    const loadError = new Error('load failed');
    let executed = false;
    let invoke: (() => Promise<unknown>) | undefined;
    const entry = definePlugin({
      id: 'failed-load', name: 'Failed load', description: 'Rejects loading.', configSchema: {},
      hooks: { onLoad: async () => { throw loadError; } },
      tools: (tool) => [tool({ name: 'run', description: 'Run.', parameters: Type.Object({}), execute: () => { executed = true; } })],
    })();

    await expect(entry.register({ registerTool: (tool) => { invoke = () => tool.execute({}, {}) as Promise<unknown>; } }, {})).rejects.toBe(loadError);
    await expect(invoke?.()).rejects.toBe(loadError);
    expect(executed).toBe(false);
  });

  it('uses the production initialization lifecycle in testPlugin', async () => {
    const order: string[] = [];
    const createEntry = definePlugin({
      id: 'test-helper-load', name: 'Test helper load', description: 'Tests helper lifecycle.', configSchema: {},
      hooks: { onLoad: async () => { order.push('load'); } },
      tools: (tool) => [tool({ name: 'run', description: 'Run.', parameters: Type.Object({}), execute: () => { order.push('execute'); return 'ok'; } })],
    });

    const { tools } = testPlugin(createEntry, {});
    await tools.run({});
    await tools.run({});
    expect(order).toEqual(['load', 'execute', 'execute']);
  });
});
