import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
  type Message,
} from '@aws-sdk/client-bedrock-runtime';
import { config } from '../../config';
import { normalizeMessages, type LlmChatOptions, type LlmService } from './LlmService';

const client = new BedrockRuntimeClient({});

function toConverseMessages(opts: LlmChatOptions): Message[] {
  return normalizeMessages(opts.messages).map((m) => ({
    role: m.role,
    content: [{ text: m.content }],
  }));
}

export class BedrockLlmService implements LlmService {
  constructor(private readonly modelId: string = config.bedrockModelId) {}

  async streamChat(
    opts: LlmChatOptions & { onDelta: (text: string) => void }
  ): Promise<string> {
    const res = await client.send(
      new ConverseStreamCommand({
        modelId: this.modelId,
        system: [{ text: opts.system }],
        messages: toConverseMessages(opts),
        inferenceConfig: {
          maxTokens: opts.maxTokens ?? 1024,
          temperature: opts.temperature ?? 0.7,
        },
      })
    );

    let full = '';
    for await (const event of res.stream ?? []) {
      const delta = event.contentBlockDelta?.delta?.text;
      if (delta) {
        full += delta;
        opts.onDelta(delta);
      }
    }
    return full;
  }

  async complete(opts: LlmChatOptions): Promise<string> {
    const res = await client.send(
      new ConverseCommand({
        modelId: this.modelId,
        system: [{ text: opts.system }],
        messages: toConverseMessages(opts),
        inferenceConfig: {
          maxTokens: opts.maxTokens ?? 2048,
          temperature: opts.temperature ?? 0.5,
        },
      })
    );
    const blocks = res.output?.message?.content ?? [];
    return blocks.map((b) => b.text ?? '').join('');
  }
}

export const llm: LlmService = new BedrockLlmService();
