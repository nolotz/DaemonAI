import type { Entry, Insight, InsightPeriod, MoodPoint, TopicCount } from '@daemonai/shared';
import * as repo from '../db/repository';
import { daysBetween, monthInfo, weekInfo } from '../lib/dates';
import { llm as defaultLlm } from './llm/BedrockLlmService';
import type { LlmService } from './llm/LlmService';

export function aggregateMoodByDay(entries: Entry[], from: string, to: string): MoodPoint[] {
  const byDay = new Map<string, number[]>();
  for (const e of entries) {
    if (e.mood === null) continue;
    const moods = byDay.get(e.date) ?? [];
    moods.push(e.mood);
    byDay.set(e.date, moods);
  }
  return daysBetween(from, to).map((date) => {
    const moods = byDay.get(date);
    return {
      date,
      mood: moods?.length
        ? Math.round((moods.reduce((a, b) => a + b, 0) / moods.length) * 10) / 10
        : null,
    };
  });
}

export function aggregateTopics(entries: Entry[], limit = 10): TopicCount[] {
  const counts = new Map<string, { topic: string; count: number }>();
  for (const e of entries) {
    for (const topic of e.topics) {
      const norm = topic.toLowerCase();
      const existing = counts.get(norm);
      if (existing) existing.count += 1;
      else counts.set(norm, { topic, count: 1 });
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

const SUMMARY_SYSTEM = `Du bist ein ruhiger, reflektierender Tagebuch-Begleiter. Du fasst einen Zeitraum aus Tagebucheinträgen zusammen: Stimmungsverlauf, wiederkehrende Themen und erkennbare Muster. Sprich den Nutzer mit "du" an, bleibe konkret und wohlwollend, ohne zu psychologisieren. Antworte auf Deutsch in 3 bis 5 Sätzen, ohne Aufzählungszeichen.`;

export class InsightService {
  constructor(private readonly llm: LlmService = defaultLlm) {}

  async getInsights(userId: string, period: InsightPeriod, refDate: string): Promise<Insight> {
    const { key, from, to } = period === 'week' ? weekInfo(refDate) : monthInfo(refDate);
    const entries = await repo.listEntriesByDateRange(userId, from, to);
    const latestEntryAt = entries[0]?.createdAt; // Query liefert absteigend

    const cached = await repo.getInsight(userId, period, key);
    if (cached && (!latestEntryAt || cached.computedAt >= latestEntryAt)) {
      return cached;
    }

    const moods = entries.map((e) => e.mood).filter((m): m is number => m !== null);
    const insight: Insight = {
      period,
      key,
      from,
      to,
      entryCount: entries.length,
      avgMood: moods.length
        ? Math.round((moods.reduce((a, b) => a + b, 0) / moods.length) * 10) / 10
        : null,
      moodByDay: aggregateMoodByDay(entries, from, to),
      topics: aggregateTopics(entries),
      summary: await this.summarize(entries),
      computedAt: new Date().toISOString(),
    };

    await repo.putInsight(userId, insight);
    return insight;
  }

  private async summarize(entries: Entry[]): Promise<string | null> {
    if (entries.length < 2) return null; // ein einzelner Eintrag hat noch kein Muster
    const digest = [...entries]
      .reverse() // chronologisch für das Modell
      .map(
        (e) =>
          `${e.date} (Stimmung: ${e.mood ?? '–'}/10, Themen: ${e.topics.join(', ') || '–'}): ${e.text.slice(0, 300)}`
      )
      .join('\n\n');
    try {
      const text = await this.llm.complete({
        system: SUMMARY_SYSTEM,
        messages: [{ role: 'user', content: digest }],
        maxTokens: 512,
        temperature: 0.5,
      });
      return text.trim() || null;
    } catch (err) {
      // Insights sollen auch ohne LLM funktionieren – Diagramme bleiben nutzbar
      console.error('Insight-Zusammenfassung fehlgeschlagen', err);
      return null;
    }
  }
}

export const insightService = new InsightService();
