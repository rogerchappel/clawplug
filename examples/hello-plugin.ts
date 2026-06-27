import { Type } from '@sinclair/typebox';
import { definePlugin } from 'clawplug';

export default definePlugin({
  id: 'hello-plugin',
  name: 'Hello Plugin',
  description: 'Returns a greeting for a supplied name.',
  configSchema: {
    auth: Type.Object({
      apiKey: Type.String(),
    }),
  },
  hooks: {
    onToolCall: (toolName) => {
      console.log(`calling ${toolName}`);
    },
  },
  tools: (tool) => [
    tool({
      name: 'hello',
      description: 'Create a greeting.',
      parameters: Type.Object({
        name: Type.String(),
      }),
      execute: ({ name }: { name: string }) => ({ message: `Hello, ${name}` }),
    }),
  ],
});
