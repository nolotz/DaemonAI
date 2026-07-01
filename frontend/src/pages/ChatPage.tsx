import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  ChatMessage,
  CompleteSessionResponse,
  Entry,
  FrameworkInfo,
  Session,
  SessionDetailResponse,
  StartSessionResponse,
  UserProfile,
} from '@daemonai/shared';
import { MicButton } from '../components/MicButton';
import { api, apiBlob, streamChat } from '../lib/api';

type Phase = 'loading' | 'start' | 'chat' | 'entry';

export function ChatPage() {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>('loading');
  const [frameworks, setFrameworks] = useState<FrameworkInfo[]>([]);
  const [selectedFramework, setSelectedFramework] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [entry, setEntry] = useState<Entry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Sprachmodus: Antworten werden per Polly vorgelesen, danach startet die
  // Aufnahme automatisch – Transkripte werden direkt gesendet.
  const [voiceMode, setVoiceMode] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [micSignal, setMicSignal] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const voiceModeRef = useRef(voiceMode);
  voiceModeRef.current = voiceMode;

  const stopSpeaking = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setSpeaking(false);
  };

  useEffect(() => stopSpeaking, []);

  const speak = async (text: string) => {
    if (!text.trim()) return;
    try {
      setSpeaking(true);
      const blob = await apiBlob('/speech', { text });
      if (!voiceModeRef.current) {
        setSpeaking(false); // Modus wurde währenddessen deaktiviert
        return;
      }
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setSpeaking(false);
        // Konversationsschleife: nach der Frage direkt zuhören
        if (voiceModeRef.current) setMicSignal((s) => s + 1);
      };
      await audio.play();
    } catch {
      setSpeaking(false); // Vorlesen ist optional – der Chat bleibt nutzbar
    }
  };

  const toggleVoiceMode = () => {
    if (voiceMode) stopSpeaking();
    setVoiceMode((v) => !v);
  };

  useEffect(() => {
    void (async () => {
      try {
        const [profile, fw] = await Promise.all([
          api<UserProfile>('/me'),
          api<{ frameworks: FrameworkInfo[] }>('/frameworks'),
        ]);
        setFrameworks(fw.frameworks);
        setSelectedFramework(profile.framework);
        if (profile.activeSessionId) {
          const detail = await api<SessionDetailResponse>(`/sessions/${profile.activeSessionId}`);
          setSession(detail.session);
          setMessages(detail.messages);
          setPhase('chat');
        } else {
          setPhase('start');
        }
      } catch (err) {
        setError((err as Error).message);
        setPhase('start');
      }
    })();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, phase]);

  const startSession = async () => {
    setError(null);
    setPhase('loading');
    try {
      const res = await api<StartSessionResponse>('/sessions', {
        method: 'POST',
        body: { framework: selectedFramework },
      });
      setSession(res.session);
      setMessages([
        {
          sessionId: res.session.sessionId,
          seq: 1,
          role: 'assistant',
          content: res.openingQuestion,
          createdAt: res.session.createdAt,
        },
      ]);
      setEntry(null);
      setPhase('chat');
      if (voiceModeRef.current) void speak(res.openingQuestion);
    } catch (err) {
      setError((err as Error).message);
      setPhase('start');
    }
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !session || streaming) return;
    setError(null);
    setInput('');
    setStreaming(true);

    const base = messages[messages.length - 1]?.seq ?? 0;
    const now = new Date().toISOString();
    const userMsg: ChatMessage = {
      sessionId: session.sessionId,
      seq: base + 1,
      role: 'user',
      content: trimmed,
      createdAt: now,
    };
    const assistantMsg: ChatMessage = {
      sessionId: session.sessionId,
      seq: base + 2,
      role: 'assistant',
      content: '',
      createdAt: now,
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    try {
      let fullReply = '';
      await streamChat({ sessionId: session.sessionId, message: trimmed }, (delta) => {
        fullReply += delta;
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          next[next.length - 1] = { ...last, content: last.content + delta };
          return next;
        });
      });
      if (voiceModeRef.current) void speak(fullReply);
    } catch (err) {
      setError((err as Error).message);
      // Leere Assistenten-Blase wieder entfernen, die Nutzer-Nachricht ist gespeichert
      setMessages((prev) => (prev[prev.length - 1]?.content === '' ? prev.slice(0, -1) : prev));
    } finally {
      setStreaming(false);
    }
  };

  const complete = async () => {
    if (!session) return;
    stopSpeaking();
    setCompleting(true);
    setError(null);
    try {
      const res = await api<CompleteSessionResponse>(`/sessions/${session.sessionId}/complete`, {
        method: 'POST',
      });
      setEntry(res.entry);
      setSession(null);
      setPhase('entry');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCompleting(false);
    }
  };

  if (phase === 'loading') {
    return <p className="py-12 text-center text-surface-700 dark:text-surface-300">{t('common.loading')}</p>;
  }

  if (phase === 'start') {
    return (
      <div className="mx-auto max-w-md py-8">
        <h1 className="text-xl font-semibold">{t('chat.startTitle')}</h1>
        <div className="mt-6 space-y-3">
          {frameworks.map((fw) => (
            <label
              key={fw.id}
              className={`block cursor-pointer rounded-xl border p-4 transition-colors ${
                selectedFramework === fw.id
                  ? 'border-accent-600 bg-accent-500/5'
                  : 'border-surface-200 hover:border-surface-300 dark:border-surface-800 dark:hover:border-surface-700'
              }`}
            >
              <input
                type="radio"
                name="framework"
                value={fw.id}
                checked={selectedFramework === fw.id}
                onChange={() => setSelectedFramework(fw.id)}
                className="sr-only"
              />
              <span className="font-medium">{fw.name}</span>
              <p className="mt-1 text-sm text-surface-700 dark:text-surface-300">{fw.description}</p>
            </label>
          ))}
        </div>
        {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          onClick={() => void startSession()}
          disabled={!selectedFramework}
          className="mt-6 w-full rounded-xl bg-accent-700 py-2.5 font-medium text-white hover:bg-accent-600 disabled:opacity-50"
        >
          {t('chat.start')}
        </button>
      </div>
    );
  }

  if (phase === 'entry' && entry) {
    return (
      <div className="mx-auto max-w-md py-8">
        <h1 className="text-xl font-semibold">{t('chat.entryCreated')}</h1>
        <article className="mt-4 rounded-xl border border-surface-200 bg-white p-4 dark:border-surface-800 dark:bg-surface-900">
          <p className="whitespace-pre-wrap leading-relaxed">{entry.text}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-surface-700 dark:text-surface-300">
            {entry.mood !== null && <span>{t('history.mood')}: {entry.mood}/10</span>}
            {entry.topics.map((topic) => (
              <span
                key={topic}
                className="rounded-full bg-surface-100 px-2 py-0.5 dark:bg-surface-800"
              >
                {topic}
              </span>
            ))}
          </div>
        </article>
        <button
          onClick={() => setPhase('start')}
          className="mt-6 w-full rounded-xl bg-accent-700 py-2.5 font-medium text-white hover:bg-accent-600"
        >
          {t('chat.newSession')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-end gap-3 pt-1">
        {speaking && (
          <span className="text-xs text-surface-700 dark:text-surface-300" aria-live="polite">
            {t('chat.speaking')}
          </span>
        )}
        <button
          onClick={toggleVoiceMode}
          aria-pressed={voiceMode}
          className={`rounded-full border px-3 py-1 text-sm transition-colors ${
            voiceMode
              ? 'border-accent-600 bg-accent-500/10 font-medium text-accent-700 dark:text-accent-400'
              : 'border-surface-200 text-surface-700 hover:border-surface-300 dark:border-surface-800 dark:text-surface-300'
          }`}
        >
          <span aria-hidden>🔊</span> {t('chat.voiceMode')}
        </button>
      </div>
      <div className="flex-1 space-y-3 py-2">
        {messages.map((msg) => (
          <div
            key={msg.seq}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 leading-relaxed sm:max-w-[75%] ${
                msg.role === 'user'
                  ? 'rounded-br-md bg-accent-700 text-white'
                  : 'rounded-bl-md border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900'
              }`}
            >
              {msg.content || t('chat.thinking')}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {error && <p className="pb-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="sticky bottom-16 flex items-end gap-2 border-t border-surface-200 bg-surface-50 pb-2 pt-3 sm:bottom-0 dark:border-surface-800 dark:bg-surface-950"
      >
        <MicButton
          disabled={streaming || speaking}
          autoStartSignal={micSignal}
          onTranscript={(text) => {
            // Im Sprachmodus direkt senden – das hält die Konversation im Fluss
            if (voiceModeRef.current) void send(text);
            else setInput((prev) => (prev ? `${prev} ${text}` : text));
          }}
          onError={setError}
        />
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
          placeholder={t('chat.inputPlaceholder')}
          rows={Math.min(4, Math.max(1, input.split('\n').length))}
          className="flex-1 resize-none rounded-xl border border-surface-300 bg-white px-3 py-2 outline-none focus:border-accent-500 dark:border-surface-700 dark:bg-surface-900"
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          className="rounded-xl bg-accent-700 px-4 py-2 font-medium text-white hover:bg-accent-600 disabled:opacity-50"
        >
          {t('chat.send')}
        </button>
      </form>

      <div className="flex justify-center pb-2">
        <button
          onClick={() => void complete()}
          disabled={streaming || completing || messages.filter((m) => m.role === 'user').length === 0}
          className="text-sm text-surface-700 underline-offset-2 hover:underline disabled:opacity-50 dark:text-surface-300"
        >
          {completing ? t('chat.completing') : t('chat.complete')}
        </button>
      </div>
    </div>
  );
}
