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

  it('represents values that JSON.stringify cannot produce as text', () => {
    expect(formatResult(undefined).content[0]?.text).toBe('undefined');
    expect(formatResult(42n).content[0]?.text).toBe('42');
  });

  it('wrapResult is a deprecated alias', () => {
    expect(wrapResult('hi')).toEqual(formatResult('hi'));
  });
});

describe('testPlugin', () => {
  it('returns a present string text field when a tool returns undefined', async () => {
    const createEntry = definePlugin({
      id: 'undefined-helper', name: 'Undefined Helper', description: 'Tests empty results.', configSchema: {},
      tools: (tool) => [tool({
        name: 'empty', description: 'Return no value.', parameters: Type.Object({}),
        execute: () => undefined,
      })],
    });

    const { tools } = await testPlugin(createEntry, {});
    expect((await tools.empty({})).content[0]?.text).toBe('undefined');
  });

  it('awaits lifecycle initialization before making tools usable', async () => {
    const order: string[] = [];
    const createEntry = definePlugin({
      id: 'test-helper', name: 'Test Helper', description: 'Helper lifecycle.', configSchema: {},
      hooks: { onLoad: async () => { await Promise.resolve(); order.push('loaded'); } },
      tools: (tool) => [tool({
        name: 'status', description: 'Status.', parameters: Type.Object({}),
        execute: () => { order.push('executed'); return 'ok'; },
      })],
    });

    const { tools } = await testPlugin(createEntry, {});
    expect(order).toEqual(['loaded']);
    await tools.status({});
    expect(order).toEqual(['loaded', 'executed']);
  });
});

describe('register + lifecycle hooks', () => {
  it('returns a present string text field when a registered tool returns undefined', async () => {
    const entry = definePlugin({
      id: 'undefined-registered', name: 'Undefined Registered', description: 'Tests empty results.', configSchema: {},
      tools: (tool) => [tool({
        name: 'empty', description: 'Return no value.', parameters: Type.Object({}),
        execute: () => undefined,
      })],
    })();
    let invoke: (() => Promise<unknown>) | undefined;
    await entry.register(
      { registerTool: (tool) => { invoke = async () => tool.execute({}, {}); } },
      {},
    );

    const result = await invoke?.() as { content: Array<{ text: string }> };
    expect(result.content[0]?.text).toBe('undefined');
  });

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

  it('awaits onLoad once before registering any tools', async () => {
    const order: string[] = [];
    let finishLoad!: () => void;
    const loaded = new Promise<void>((resolve) => { finishLoad = resolve; });
    const entry = definePlugin({
      id: 'async-load', name: 'Async Load', description: 'Async initialization.',
      configSchema: { $flat: true, schema: Type.Object({ value: Type.String() }) },
      hooks: { onLoad: async (config) => { order.push(`load:${config.value}`); await loaded; order.push('loaded'); } },
      tools: (tool) => [tool({ name: 'ready', description: 'Ready.', parameters: Type.Object({}), execute: () => 'ready' })],
    })();

    const registration = entry.register(
      { registerTool: () => { order.push('registered'); } },
      { value: 'configured' },
    );
    await Promise.resolve();
    expect(order).toEqual(['load:configured']);
    finishLoad();
    await registration;
    expect(order).toEqual(['load:configured', 'loaded', 'registered']);
  });

  it('propagates onLoad rejection without partial registration', async () => {
    const registered: string[] = [];
    const entry = definePlugin({
      id: 'failed-load', name: 'Failed Load', description: 'Failed initialization.', configSchema: {},
      hooks: { onLoad: async () => { throw new Error('cannot connect'); } },
      tools: (tool) => [tool({ name: 'unavailable', description: 'Unavailable.', parameters: Type.Object({}), execute: () => 'no' })],
    })();

    await expect(entry.register(
      { registerTool: (tool) => { registered.push(tool.name); } },
      {},
    )).rejects.toThrow('cannot connect');
    expect(registered).toEqual([]);
  });
});
