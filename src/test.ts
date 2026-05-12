import { wrapResult, type PluginEntry } from './index.js';

export function testPlugin<Config>(createEntry: () => PluginEntry<Config>, config: Config) {
  const entry = createEntry();
  const tools = Object.fromEntries(
    entry.tools.map((tool) => [
      tool.name,
      async (params: unknown) => {
        await entry.hooks.onToolCall?.(tool.name, params, config);
        try {
          return wrapResult(await tool.execute(params, config));
        } catch (error) {
          await entry.hooks.onError?.(tool.name, error, config);
          throw error;
        }
      },
    ]),
  );
  return { entry, tools } as { entry: PluginEntry<Config>; tools: Record<string, (params: unknown) => Promise<ReturnType<typeof wrapResult>>> };
}
