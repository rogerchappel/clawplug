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
  /** Register all tools with the host, wrapping execute() with result formatting. */
  register(api: { registerTool: (tool: PluginTool<unknown, Config>) => void }, config: Config): Promise<void> | void;
}

export interface OpenClawResult {
  content: Array<{ type: 'text'; text: string }>;
}

export function definePlugin<const Config extends ConfigSections>(definition: PluginDefinition<Config>) {
  return function createEntry(): PluginEntry<InferConfig<Config>> {
    const tool = <Params>(toolDefinition: PluginTool<Params, InferConfig<Config>>) => toolDefinition as PluginTool<unknown, InferConfig<Config>>;
    const rawTools = definition.tools(tool);

    // Task 1.3 — register() wraps each tool's execute with automatic result formatting
    const register = (
      api: { registerTool: (tool: PluginTool<unknown, InferConfig<Config>>) => void },
      config: InferConfig<Config>,
    ) => {
      for (const rawTool of rawTools) {
        api.registerTool({
          name: rawTool.name,
          description: rawTool.description,
          parameters: rawTool.parameters,
          execute: async (params, cfg) => {
            // Task 1.4 — onToolCall hook fires before execution
            await definition.hooks?.onToolCall?.(rawTool.name, params, cfg);
            try {
              const result = await rawTool.execute(params as never, cfg);
              return formatResult(result);
            } catch (err) {
              // Task 1.4 — onError hook fires on failure
              await definition.hooks?.onError?.(rawTool.name, err, cfg);
              throw err;
            }
          },
        });
      }
    };

    return {
      id: definition.id,
      name: definition.name,
      description: definition.description,
      configSchema: definition.configSchema,
      hooks: definition.hooks ?? {},
      tools: rawTools,
      register,
    };
  };
}

/**
 * Format a plain result object into the OpenClaw protocol format.
 * Plugin authors return any serialisable value from execute(); this
 * normalises it to the `{ content: [{ type: 'text', text: ... }] }`
 * shape expected by the OpenClaw gateway.
 */
export function formatResult(value: unknown): OpenClawResult {
  return {
    content: [
      {
        type: 'text',
        text: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

/** @deprecated Use formatResult instead. Kept for backward compatibility. */
export const wrapResult = formatResult;
