import type { Static, TObject, TSchema } from '@sinclair/typebox';

/* ---------- Named section config (the default) ---------- */

/** A record of named section schemas, e.g. `{ auth: Type.Object({ apiKey: Type.String() }) }` */
export type ConfigSections = Record<string, TSchema>;

/** Inferred runtime config from named sections. */
export type InferConfig<T extends ConfigSections> = { [K in keyof T]: Static<T[K]> };

/* ---------- Flat config (single Type.Object) ---------- */

/** Marker to declare a flat config schema instead of sections.
 *  Usage: `configSchema: { $flat: Type.Object({ host: Type.String() }) }`
 */
export interface FlatConfigSchema<T extends TObject = TObject> {
  /** @internal Do not set manually. */
  $flat: true;
  schema: T;
}

/** Inferred runtime config from a flat schema. */
export type InferFlatConfig<T extends FlatConfigSchema> = Static<T['schema']>;

/* ---------- Accept either at the API level ---------- */

/** Task 1.2 — configSchema accepts either a FlatConfigSchema wrapper or a record of named section schemas. */
export type ConfigSchema = FlatConfigSchema | ConfigSections;

/** Resolve the runtime config type from either kind. */
export type ResolveConfig<S extends ConfigSchema> =
  S extends FlatConfigSchema
    ? InferFlatConfig<S>
    : S extends ConfigSections
      ? InferConfig<S>
      : never;

/* ---------- Core types ---------- */

export interface PluginTool<Params, Config> {
  name: string;
  description: string;
  parameters: TSchema;
  execute(params: Params, config: Config): Promise<unknown> | unknown;
}

/** Lifecycle hook that may perform side effects. Return value is ignored. */
type HookFn<Config, Args extends unknown[]> =
  | ((...args: Args) => void)
  | ((...args: Args) => Promise<void>);

export interface PluginHooks<Config> {
  /** Called once when the plugin is loaded — validate connectivity, warm caches. */
  onLoad?: HookFn<Config, [config: Config]>;
  /** Fires before each tool call — logging, rate limiting, auth checks. */
  onToolCall?: HookFn<Config, [toolName: string, params: unknown, config: Config]>;
  /** Fires on execute errors — logging, retries, graceful degradation. */
  onError?: HookFn<Config, [toolName: string, error: unknown, config: Config]>;
}

export interface PluginDefinition<S extends ConfigSchema> {
  id: string;
  name: string;
  description: string;
  configSchema: S;
  hooks?: PluginHooks<ResolveConfig<S>>;
  tools: (
    tool: <Params>(def: PluginTool<Params, ResolveConfig<S>>) => PluginTool<Params, ResolveConfig<S>>,
  ) => Array<PluginTool<unknown, ResolveConfig<S>>>;
}

export interface PluginEntry<Config> {
  id: string;
  name: string;
  description: string;
  /** Normalised: always a record of named section schemas. Flat schemas become `_default`. */
  configSchema: ConfigSections;
  hooks: PluginHooks<Config>;
  tools: Array<PluginTool<unknown, Config>>;
  /** Register all tools with the host, wrapping execute() with result formatting and lifecycle hooks. */
  register(api: { registerTool: (tool: PluginTool<unknown, Config>) => void }, config: Config): Promise<void> | void;
}

export interface OpenClawResult {
  content: Array<{ type: 'text'; text: string }>;
}

/* ---------- Builder ---------- */

/** tRPC-style factory that creates a typed plugin entry. */
export function definePlugin<const S extends ConfigSchema>(definition: PluginDefinition<S>) {
  return function createEntry(): PluginEntry<ResolveConfig<S>> {
    const tool = <Params>(def: PluginTool<Params, ResolveConfig<S>>) =>
      def as PluginTool<unknown, ResolveConfig<S>>;

    const rawTools = definition.tools(tool);

    // Normalise flat schemas into a single _default section for manifest generation
    const normalisedSchema = definition.configSchema && '$flat' in definition.configSchema
      ? { _default: (definition.configSchema as FlatConfigSchema).schema }
      : definition.configSchema as ConfigSections;

    const register = async (
      api: { registerTool: (tool: PluginTool<unknown, ResolveConfig<S>>) => void },
      config: ResolveConfig<S>,
    ): Promise<void> => {
      await definition.hooks?.onLoad?.(config);

      for (const rawTool of rawTools) {
        api.registerTool({
          name: rawTool.name,
          description: rawTool.description,
          parameters: rawTool.parameters,
          execute: async (params, cfg) => {
            await definition.hooks?.onToolCall?.(rawTool.name, params as unknown, cfg);
            try {
              const result = await rawTool.execute(params as never, cfg);
              return formatResult(result);
            } catch (err) {
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
      configSchema: normalisedSchema,
      hooks: definition.hooks ?? {},
      tools: rawTools,
      register,
    };
  };
}

/* ---------- Result formatting ---------- */

/**
 * Format a plain result value into the OpenClaw protocol format.
 * Plugin authors return any serialisable value from execute(); this
 * normalises it to the `{ content: [{ type: 'text', text: ... }] }`
 * shape expected by the gateway.
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
