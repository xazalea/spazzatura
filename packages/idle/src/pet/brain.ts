import { OllamaProvider } from '@spazzatura/provider';
import type { Message } from '@spazzatura/provider';

const SYSTEM_PROMPT =
  'You are a tiny ASCII creature living in the terminal. You help the developer with small tasks and friendly chat. Be very concise (1-2 sentences max). Use cute ASCII emoticons like (^_^) OwO etc.';

export class PetBrain {
  private readonly provider: OllamaProvider;

  constructor() {
    this.provider = new OllamaProvider({
      defaultModel: 'llama3.2',
    });
  }

  async think(userMessage: string, context?: string): Promise<string> {
    const messages: Message[] = [
      { role: 'system', content: SYSTEM_PROMPT },
    ];

    if (context) {
      messages.push({
        role: 'system',
        content: `Current context: ${context}`,
      });
    }

    messages.push({ role: 'user', content: userMessage });

    try {
      const response = await this.provider.chat(messages);
      return response.content;
    } catch {
      return '(>_<) Oops, my brain is fuzzy right now!';
    }
  }

  async getIdleThought(taskResult?: string): Promise<string> {
    const prompt = taskResult
      ? `I just checked: ${taskResult}. What do you think?`
      : 'Say something cute and encouraging to your developer!';
    return this.think(prompt);
  }
}
