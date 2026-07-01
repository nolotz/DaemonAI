/**
 * Anbieter-neutrale LLM-Schnittstelle. Bedrock ist nur eine Implementierung –
 * ein Ollama- oder OpenAI-Adapter muss lediglich dieses Interface erfüllen.
 */
export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LlmChatOptions {
  system: string;
  messages: LlmMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface LlmService {
  /** Streamt die Antwort tokenweise über onDelta und liefert den Gesamttext zurück. */
  streamChat(opts: LlmChatOptions & { onDelta: (text: string) => void }): Promise<string>;
  /** Nicht-streamende Vervollständigung (Zusammenfassungen, Insights). */
  complete(opts: LlmChatOptions): Promise<string>;
}

/**
 * Bedrock (Converse-API) verlangt: erste Nachricht vom Nutzer und strikt
 * alternierende Rollen. Interviews beginnen aber mit der Eröffnungsfrage der
 * KI – deshalb hier normalisieren statt in jedem Aufrufer.
 */
export function normalizeMessages(messages: LlmMessage[]): LlmMessage[] {
  const result: LlmMessage[] = [];
  for (const msg of messages) {
    if (!msg.content.trim()) continue;
    const prev = result[result.length - 1];
    if (prev && prev.role === msg.role) {
      prev.content = `${prev.content}\n\n${msg.content}`;
    } else {
      result.push({ ...msg });
    }
  }
  if (result[0]?.role === 'assistant') {
    result.unshift({ role: 'user', content: '[Der Nutzer startet die Tagebuch-Session.]' });
  }
  return result;
}
