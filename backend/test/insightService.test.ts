import type { Entry } from '@daemonai/shared';
import { describe, expect, it } from 'vitest';
import { aggregateMoodByDay, aggregateTopics } from '../src/services/InsightService';

const entry = (date: string, mood: number | null, topics: string[] = []): Entry => ({
  entryId: `id-${date}-${mood}`,
  userId: 'u1',
  sessionId: 's1',
  date,
  text: 'Text',
  mood,
  topics,
  createdAt: `${date}T21:00:00.000Z`,
});

describe('aggregateMoodByDay', () => {
  it('mittelt mehrere Einträge pro Tag und lässt Lücken als null', () => {
    const result = aggregateMoodByDay(
      [entry('2026-06-29', 6), entry('2026-06-29', 9), entry('2026-07-01', 4)],
      '2026-06-29',
      '2026-07-01'
    );
    expect(result).toEqual([
      { date: '2026-06-29', mood: 7.5 },
      { date: '2026-06-30', mood: null },
      { date: '2026-07-01', mood: 4 },
    ]);
  });

  it('ignoriert Einträge ohne Stimmungswert', () => {
    const result = aggregateMoodByDay([entry('2026-06-29', null)], '2026-06-29', '2026-06-29');
    expect(result).toEqual([{ date: '2026-06-29', mood: null }]);
  });
});

describe('aggregateTopics', () => {
  it('zählt Themen case-insensitiv und sortiert nach Häufigkeit', () => {
    const result = aggregateTopics([
      entry('2026-06-29', 5, ['Arbeit', 'Sport']),
      entry('2026-06-30', 5, ['arbeit']),
      entry('2026-07-01', 5, ['Familie']),
    ]);
    expect(result[0]).toEqual({ topic: 'Arbeit', count: 2 });
    expect(result).toHaveLength(3);
  });
});
