import { Type } from '@sinclair/typebox';
import { definePlugin } from 'clawplug';

export default definePlugin({
  id: 'tweetclaw-source-review',
  name: 'TweetClaw Source Review',
  description: 'Prepares TweetClaw source packets for human review before any social account action.',
  configSchema: {
    policy: Type.Object({
      requireApproval: Type.Boolean({ default: true }),
    }),
  },
  hooks: {
    onToolCall: (toolName, params, config) => {
      if (toolName === 'prepare_review' && !config.policy.requireApproval) {
        throw new Error('TweetClaw review preparation requires approval policy to stay enabled.');
      }
    },
  },
  tools: (tool) => [
    tool({
      name: 'prepare_review',
      description: 'Prepare a review packet from public X/Twitter source evidence.',
      parameters: Type.Object({
        topic: Type.String(),
        sourceUrls: Type.Array(Type.String({ format: 'uri' }), { minItems: 1 }),
        summary: Type.String(),
      }),
      execute: (
        params: { topic: string; sourceUrls: string[]; summary: string },
        config: { policy: { requireApproval: boolean } },
      ) => ({
        approvalRequired: config.policy.requireApproval,
        topic: params.topic,
        sourceCount: params.sourceUrls.length,
        summary: params.summary,
        nextStep: 'Review the packet in OpenClaw before publishing or scheduling.',
      }),
    }),
  ],
});
