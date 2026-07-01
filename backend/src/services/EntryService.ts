import type { Entry } from '@daemonai/shared';
import { ulid } from 'ulid';
import * as repo from '../db/repository';
import { buildSummaryPrompt, getFramework } from '../frameworks/registry';
import { berlinToday } from '../lib/dates';
import { HttpError } from '../lib/http';
import { llm as defaultLlm } from './llm/BedrockLlmService';
import type { LlmService } from './llm/LlmService';

export interface ParsedSummary {
  text: string;
  mood: number | null;
  topics: string[];
}

/**
 * Robust gegen Modell-Ausgaben, die um das JSON herum Text oder Markdown
 * enthalten. Fällt im Zweifel auf den Rohtext als Eintrag zurück, damit die
 * Antworten des Nutzers nie verloren gehen.
 */
export function parseSummary(raw: string): ParsedSummary {
  const fallback: ParsedSummary = { text: raw.trim(), mood: null, topics: [] };
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) return fallback;

  try {
    const obj = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
    const text =
      typeof obj.text === 'string' && obj.text.trim() ? obj.text.trim() : fallback.text;
    const mood =
      typeof obj.mood === 'number' && obj.mood >= 1 && obj.mood <= 10
        ? Math.round(obj.mood)
        : null;
    const topics = Array.isArray(obj.topics)
      ? obj.topics
          .filter((t): t is string => typeof t === 'string')
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 8)
      : [];
    return { text, mood, topics };
  } catch {
    return fallback;
  }
}

export function buildTranscript(messages: Array<{ role: string; content: string }>): string {
  return messages
    .map((m) => `${m.role === 'user' ? 'Nutzer' : 'Interviewer'}: ${m.content}`)
    .join('\n\n');
}

export class EntryService {
  constructor(private readonly llm: LlmService = defaultLlm) {}

  /** Schließt die Session ab und erzeugt daraus den Tagebucheintrag. */
  async completeSession(userId: string, sessionId: string): Promise<Entry> {
    const session = await repo.getSession(userId, sessionId);
    if (!session) throw new HttpError(404, 'Session nicht gefunden');
    if (session.status !== 'active') {
      throw new HttpError(409, 'Diese Session ist bereits abgeschlossen');
    }

    const messages = await repo.listMessages(sessionId);
    const hasUserInput = messages.some((m) => m.role === 'user' && m.content.trim());
    if (!hasUserInput) {
      throw new HttpError(400, 'Die Session enthält noch keine Antworten');
    }

    const framework = getFramework(session.framework);
    if (!framework) throw new HttpError(500, 'Framework der Session nicht mehr vorhanden');

    const raw = await this.llm.complete({
      system: buildSummaryPrompt(framework),
      messages: [{ role: 'user', content: buildTranscript(messages) }],
      temperature: 0.4,
    });
    const summary = parseSummary(raw);

    const entry: Entry = {
      entryId: ulid(),
      userId,
      sessionId,
      date: berlinToday(),
      text: summary.text,
      mood: summary.mood,
      topics: summary.topics,
      createdAt: new Date().toISOString(),
    };

    await repo.completeSessionWithEntry(entry, 'completed');
    await repo.clearActiveSession(userId, sessionId);
    return entry;
  }
}

export const entryService = new EntryService();
