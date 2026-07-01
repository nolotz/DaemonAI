import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import type { Entry } from '@daemonai/shared';
import { describe, expect, it } from 'vitest';
import { filterEntries, handler as entriesHandler } from '../src/handlers/entries';

const eventWithoutAuth = {
  routeKey: 'GET /entries',
  requestContext: { http: { method: 'GET', path: '/entries' } },
} as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;

describe('API-Autorisierung', () => {
  it('weist Requests ohne verifizierte JWT-Claims mit 401 ab', async () => {
    const result = await entriesHandler(eventWithoutAuth);
    expect(result).toMatchObject({ statusCode: 401 });
  });
});

describe('filterEntries (Suche)', () => {
  const entries: Entry[] = [
    {
      entryId: 'e1',
      userId: 'u1',
      sessionId: 's1',
      date: '2026-07-01',
      text: 'Heute war ich wandern in den Bergen.',
      mood: 8,
      topics: ['Natur'],
      createdAt: '2026-07-01T21:00:00.000Z',
    },
    {
      entryId: 'e2',
      userId: 'u1',
      sessionId: 's2',
      date: '2026-07-02',
      text: 'Langer Arbeitstag im Büro.',
      mood: 4,
      topics: ['Arbeit'],
      createdAt: '2026-07-02T21:00:00.000Z',
    },
  ];

  it('findet Treffer im Text unabhängig von Groß-/Kleinschreibung', () => {
    expect(filterEntries(entries, 'WANDERN')).toHaveLength(1);
    expect(filterEntries(entries, 'wandern')[0].entryId).toBe('e1');
  });

  it('findet Treffer in den Themen', () => {
    expect(filterEntries(entries, 'arbeit')[0].entryId).toBe('e2');
  });

  it('liefert ohne Suchbegriff alles zurück', () => {
    expect(filterEntries(entries, undefined)).toHaveLength(2);
    expect(filterEntries(entries, '  ')).toHaveLength(2);
  });
});
