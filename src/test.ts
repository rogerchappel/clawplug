import { wrapResult, type PluginEntry } from './index.js';

export function testPlugin<Config>(createEntry: () => PluginEntry<Config>, config: Config) {
  const entry = createEntry();
  const registered: Record<string, (params: unknown) => Promise<ReturnType<typeof wrapResult>>> = {};
  const ready = entry.register({
    registerTool: (tool) => {
      registered[tool.name] = async (params) => tool.execute(params, config) as Promise<ReturnType<typeof wrapResult>>;
    },
  }, config);
  const tools = Object.fromEntries(entry.tools.map((tool) => [
    tool.name,
    async (params: unknown) => {
      await ready;
      return registered[tool.name]!(params);
    },
  ]));
  return { entry, tools } as { entry: PluginEntry<Config>; tools: Record<string, (params: unknown) => Promise<ReturnType<typeof wrapResult>>> };
}
