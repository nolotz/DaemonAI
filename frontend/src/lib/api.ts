import type { ChatRequest, ChatStreamEvent } from '@daemonai/shared';
import { config } from '../config';
import { getIdToken } from './cognito';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function authHeader(): Promise<Record<string, string>> {
  const token = await getIdToken();
  if (!token) throw new ApiError(401, 'Nicht angemeldet');
  return { authorization: `Bearer ${token}` };
}

export async function api<T>(
  path: string,
  init?: { method?: string; body?: unknown; query?: Record<string, string | undefined> }
): Promise<T> {
  const url = new URL(config.apiUrl + path);
  for (const [key, value] of Object.entries(init?.query ?? {})) {
    if (value !== undefined && value !== '') url.searchParams.set(key, value);
  }

  const res = await fetch(url, {
    method: init?.method ?? 'GET',
    headers: {
      ...(await authHeader()),
      ...(init?.body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new ApiError(res.status, body.message ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

/** POST mit Binärantwort (z. B. Polly-MP3 von /speech). */
export async function apiBlob(path: string, body: unknown): Promise<Blob> {
  const res = await fetch(config.apiUrl + path, {
    method: 'POST',
    headers: { ...(await authHeader()), 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    throw new ApiError(res.status, err.message ?? `HTTP ${res.status}`);
  }
  return res.blob();
}

/**
 * Konsumiert den SSE-Stream der Chat-Function-URL über fetch + ReadableStream –
 * EventSource kann keine POST-Requests mit Authorization-Header.
 */
export async function streamChat(
  request: ChatRequest,
  onDelta: (text: string) => void
): Promise<void> {
  const res = await fetch(config.chatUrl, {
    method: 'POST',
    headers: { ...(await authHeader()), 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok || !res.body) {
    throw new ApiError(res.status, `Chat-Stream fehlgeschlagen (HTTP ${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? ''; // letztes, evtl. unvollständiges Frame behalten
    for (const frame of frames) {
      const data = frame
        .split('\n')
        .filter((l) => l.startsWith('data: '))
        .map((l) => l.slice(6))
        .join('');
      if (!data) continue;
      const event = JSON.parse(data) as ChatStreamEvent;
      if (event.type === 'delta') onDelta(event.text);
      if (event.type === 'error') throw new ApiError(500, event.message);
      if (event.type === 'done') return;
    }
  }
}
