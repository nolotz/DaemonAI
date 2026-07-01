import type { ChatMessage, Session, StartSessionResponse } from '@daemonai/shared';
import { ulid } from 'ulid';
import * as repo from '../db/repository';
import { buildSystemPrompt, getFramework } from '../frameworks/registry';
import { HttpError } from '../lib/http';
import { llm as defaultLlm } from './llm/BedrockLlmService';
import type { LlmMessage, LlmService } from './llm/LlmService';
import { ensureProfile } from './ProfileService';

export class InterviewService {
  constructor(private readonly llm: LlmService = defaultLlm) {}

  async startSession(
    userId: string,
    email: string,
    frameworkId?: string
  ): Promise<StartSessionResponse> {
    const profile = await ensureProfile(userId, email);
    const framework = getFramework(frameworkId ?? profile.framework);
    if (!framework) {
      throw new HttpError(400, `Unbekanntes Framework: ${frameworkId}`);
    }

    const now = new Date().toISOString();
    const session: Session = {
      sessionId: ulid(),
      userId,
      framework: framework.id,
      status: 'active',
      messageCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    await repo.createSession(session);

    const opening: ChatMessage = {
      sessionId: session.sessionId,
      seq: 1,
      role: 'assistant',
      content: framework.openingQuestion,
      createdAt: now,
    };
    await repo.appendMessage(userId, opening, 0);
    await repo.putProfile({ ...profile, activeSessionId: session.sessionId });

    return {
      session: { ...session, messageCount: 1 },
      openingQuestion: framework.openingQuestion,
    };
  }

  /** Lädt die Session des Nutzers oder wirft 404 – nie Daten fremder Nutzer. */
  async requireOwnSession(userId: string, sessionId: string): Promise<Session> {
    const session = await repo.getSession(userId, sessionId);
    if (!session) throw new HttpError(404, 'Session nicht gefunden');
    return session;
  }

  async chat(
    userId: string,
    sessionId: string,
    text: string,
    onDelta: (delta: string) => void
  ): Promise<{ seq: number; content: string }> {
    const trimmed = text.trim();
    if (!trimmed) throw new HttpError(400, 'Leere Nachricht');
    if (trimmed.length > 8000) throw new HttpError(400, 'Nachricht zu lang (max. 8000 Zeichen)');

    const session = await this.requireOwnSession(userId, sessionId);
    if (session.status !== 'active') {
      throw new HttpError(409, 'Diese Session ist bereits abgeschlossen');
    }
    const framework = getFramework(session.framework);
    if (!framework) throw new HttpError(500, 'Framework der Session nicht mehr vorhanden');

    const history = await repo.listMessages(sessionId);

    const userSeq = session.messageCount + 1;
    const userMessage: ChatMessage = {
      sessionId,
      seq: userSeq,
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    await repo.appendMessage(userId, userMessage, session.messageCount);

    const llmMessages: LlmMessage[] = [...history, userMessage].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const content = await this.llm.streamChat({
      system: buildSystemPrompt(framework),
      messages: llmMessages,
      onDelta,
    });

    const assistantSeq = userSeq + 1;
    await repo.appendMessage(
      userId,
      {
        sessionId,
        seq: assistantSeq,
        role: 'assistant',
        content,
        createdAt: new Date().toISOString(),
      },
      userSeq
    );

    return { seq: assistantSeq, content };
  }
}

export const interviewService = new InterviewService();
