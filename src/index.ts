import type { Static, TSchema } from '@sinclair/typebox';

export type ConfigSections = Record<string, TSchema>;
export type InferConfig<T extends ConfigSections> = { [K in keyof T]: Static<T[K]> };

export interface PluginTool<Params, Config> {
  name: string;
  description: string;
  parameters: TSchema;
  execute(params: Params, config: Config): Promise<unknown> | unknown;
}

export interface PluginHooks<Config> {
  onLoad?: (config: Config) => Promise<void> | void;
  onToolCall?: (toolName: string, params: unknown, config: Config) => Promise<void> | void;
  onError?: (toolName: string, error: unknown, config: Config) => Promise<void> | void;
}

export interface PluginDefinition<Config extends ConfigSections> {
  id: string;
  name: string;
  description: string;
  configSchema: Config;
  hooks?: PluginHooks<InferConfig<Config>>;
  tools: (tool: <Params>(definition: PluginTool<Params, InferConfig<Config>>) => PluginTool<Params, InferConfig<Config>>) => Array<PluginTool<unknown, InferConfig<Config>>>;
}

export interface PluginEntry<Config> {
  id: string;
  name: string;
  description: string;
  configSchema: ConfigSections;
  hooks: PluginHooks<Config>;
  tools: Array<PluginTool<unknown, Config>>;
}

export interface OpenClawResult {
  content: Array<{ type: 'text'; text: string }>;
}

export function definePlugin<const Config extends ConfigSections>(definition: PluginDefinition<Config>) {
  return function createEntry(): PluginEntry<InferConfig<Config>> {
    const tool = <Params>(toolDefinition: PluginTool<Params, InferConfig<Config>>) => toolDefinition as PluginTool<unknown, InferConfig<Config>>;
    return {
      id: definition.id,
      name: definition.name,
      description: definition.description,
      configSchema: definition.configSchema,
      hooks: definition.hooks ?? {},
      tools: definition.tools(tool),
    };
  };
}

export function wrapResult(value: unknown): OpenClawResult {
  return {
    content: [
      {
        type: 'text',
        text: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}
