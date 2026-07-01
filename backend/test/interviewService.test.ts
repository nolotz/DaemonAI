import type { Session } from '@daemonai/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as repo from '../src/db/repository';
import { HttpError } from '../src/lib/http';
import { InterviewService } from '../src/services/InterviewService';
import type { LlmService } from '../src/services/llm/LlmService';

vi.mock('../src/db/repository');

const fakeLlm: LlmService = {
  streamChat: vi.fn(async ({ onDelta }) => {
    onDelta('Wie ');
    onDelta('ging es weiter?');
    return 'Wie ging es weiter?';
  }),
  complete: vi.fn(async () => '{"text":"x","mood":5,"topics":[]}'),
};

const activeSession: Session = {
  sessionId: 's1',
  userId: 'u1',
  framework: 'daily-review',
  status: 'active',
  messageCount: 1,
  createdAt: '2026-07-01T20:00:00.000Z',
  updatedAt: '2026-07-01T20:00:00.000Z',
};

describe('InterviewService.chat', () => {
  const service = new InterviewService(fakeLlm);

  beforeEach(() => {
    vi.mocked(repo.getSession).mockReset();
    vi.mocked(repo.listMessages).mockResolvedValue([
      {
        sessionId: 's1',
        seq: 1,
        role: 'assistant',
        content: 'Was ist heute passiert?',
        createdAt: '2026-07-01T20:00:00.000Z',
      },
    ]);
    vi.mocked(repo.appendMessage).mockResolvedValue();
  });

  it('weist Sessions ab, die dem Nutzer nicht gehören (404 statt Datenleck)', async () => {
    // Fremde Sessions sind über das Key-Design unsichtbar ⇒ getSession liefert null
    vi.mocked(repo.getSession).mockResolvedValue(null);

    await expect(
      service.chat('angreifer', 's1', 'Hallo', () => {})
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(fakeLlm.streamChat).not.toHaveBeenCalled();
    expect(repo.getSession).toHaveBeenCalledWith('angreifer', 's1');
  });

  it('weist abgeschlossene Sessions ab', async () => {
    vi.mocked(repo.getSession).mockResolvedValue({ ...activeSession, status: 'completed' });

    await expect(service.chat('u1', 's1', 'Hallo', () => {})).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('weist leere Nachrichten ab, ohne die Datenbank anzufassen', async () => {
    await expect(service.chat('u1', 's1', '   ', () => {})).rejects.toBeInstanceOf(HttpError);
    expect(repo.getSession).not.toHaveBeenCalled();
  });

  it('streamt die Antwort und persistiert Nutzer- und Assistenten-Nachricht', async () => {
    vi.mocked(repo.getSession).mockResolvedValue({ ...activeSession });
    const deltas: string[] = [];

    const result = await service.chat('u1', 's1', 'Ich war wandern.', (d) => deltas.push(d));

    expect(deltas.join('')).toBe('Wie ging es weiter?');
    expect(result).toEqual({ seq: 3, content: 'Wie ging es weiter?' });

    const appended = vi.mocked(repo.appendMessage).mock.calls;
    expect(appended).toHaveLength(2);
    expect(appended[0][1]).toMatchObject({ seq: 2, role: 'user', content: 'Ich war wandern.' });
    expect(appended[1][1]).toMatchObject({ seq: 3, role: 'assistant' });
  });
});
