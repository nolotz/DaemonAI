import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import type { Entry, ListEntriesResponse } from '@daemonai/shared';
import * as repo from '../db/repository';
import { userFromApiEvent } from '../lib/auth';
import { addDays, berlinToday } from '../lib/dates';
import { errorResponse, HttpError, json, requirePathParam } from '../lib/http';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function requireDate(value: string, name: string): string {
  if (!DATE_RE.test(value)) throw new HttpError(400, `Ungültiges Datum für "${name}" (YYYY-MM-DD)`);
  return value;
}

/** Volltextsuche über Query + serverseitigem Filter – für Tagebuch-Datenmengen ausreichend. */
export function filterEntries(entries: Entry[], query: string | undefined): Entry[] {
  const q = query?.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter(
    (e) =>
      e.text.toLowerCase().includes(q) || e.topics.some((t) => t.toLowerCase().includes(q))
  );
}

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  try {
    const user = userFromApiEvent(event);

    switch (event.routeKey) {
      case 'GET /entries': {
        const params = event.queryStringParameters ?? {};
        const to = requireDate(params.to ?? berlinToday(), 'to');
        const from = requireDate(params.from ?? addDays(to, -90), 'from');
        const entries = await repo.listEntriesByDateRange(user.sub, from, to);
        const response: ListEntriesResponse = { entries: filterEntries(entries, params.q) };
        return json(200, response);
      }
      case 'GET /entries/{date}/{id}': {
        const date = requireDate(requirePathParam(event.pathParameters, 'date'), 'date');
        const entryId = requirePathParam(event.pathParameters, 'id');
        const entry = await repo.getEntry(user.sub, date, entryId);
        if (!entry) throw new HttpError(404, 'Eintrag nicht gefunden');
        return json(200, entry);
      }
      default:
        throw new HttpError(404, 'Route nicht gefunden');
    }
  } catch (err) {
    return errorResponse(err);
  }
};
