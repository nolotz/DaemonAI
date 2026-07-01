import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  CreateTranscriptionResponse,
  TranscriptionStatusResponse,
} from '@daemonai/shared';
import { api } from '../lib/api';

type MicState = 'idle' | 'recording' | 'processing';

// Minimale Typen für die Web Speech API (nicht in lib.dom enthalten)
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

function speechRecognitionCtor(): (new () => SpeechRecognitionLike) | undefined {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition) as
    | (new () => SpeechRecognitionLike)
    | undefined;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Audio hochladen → Transcribe-Job starten → Ergebnis pollen. */
async function transcribeViaAws(blob: Blob, contentType: string): Promise<string> {
  const { transcriptionId, uploadUrl } = await api<CreateTranscriptionResponse>(
    '/transcriptions',
    { method: 'POST', body: { contentType } }
  );
  const upload = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': contentType },
    body: blob,
  });
  if (!upload.ok) throw new Error(`Upload fehlgeschlagen (HTTP ${upload.status})`);

  await api(`/transcriptions/${transcriptionId}/start`, {
    method: 'POST',
    body: { contentType },
  });

  for (let attempt = 0; attempt < 45; attempt++) {
    await sleep(2000);
    const status = await api<TranscriptionStatusResponse>(`/transcriptions/${transcriptionId}`);
    if (status.status === 'completed') return status.text ?? '';
    if (status.status === 'failed') throw new Error(status.error ?? 'Transkription fehlgeschlagen');
  }
  throw new Error('Zeitüberschreitung bei der Transkription');
}

export function MicButton({
  onTranscript,
  onError,
  disabled,
  autoStartSignal = 0,
}: {
  onTranscript: (text: string) => void;
  onError: (message: string) => void;
  disabled?: boolean;
  /** Bei jeder Erhöhung startet die Aufnahme automatisch (Sprachmodus). */
  autoStartSignal?: number;
}) {
  const { t } = useTranslation();
  const [state, setState] = useState<MicState>('idle');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const speechRef = useRef<SpeechRecognitionLike | null>(null);

  const canRecord =
    typeof MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      setState('processing');
      try {
        const text = await transcribeViaAws(new Blob(chunks, { type: mimeType }), mimeType);
        if (text) onTranscript(text);
      } catch {
        onError(t('chat.micError'));
      } finally {
        setState('idle');
      }
    };

    recorderRef.current = recorder;
    recorder.start();
    setState('recording');
  };

  /** Fallback: Web Speech API direkt im Browser (sofort, aber nicht überall verfügbar). */
  const startWebSpeech = () => {
    const Ctor = speechRecognitionCtor();
    if (!Ctor) {
      onError(t('chat.micError'));
      return;
    }
    const recognition = new Ctor();
    recognition.lang = 'de-DE';
    recognition.continuous = true;
    recognition.interimResults = false;
    let transcript = '';
    recognition.onresult = (event) => {
      transcript = Array.from({ length: event.results.length }, (_, i) =>
        event.results[i][0].transcript
      ).join(' ');
    };
    recognition.onerror = () => onError(t('chat.micError'));
    recognition.onend = () => {
      setState('idle');
      if (transcript.trim()) onTranscript(transcript.trim());
    };
    speechRef.current = recognition;
    recognition.start();
    setState('recording');
  };

  const toggle = async () => {
    if (state === 'recording') {
      recorderRef.current?.stop();
      speechRef.current?.stop();
      recorderRef.current = null;
      speechRef.current = null;
      return;
    }
    try {
      if (canRecord) await startRecording();
      else startWebSpeech();
    } catch {
      // Mikrofonzugriff verweigert o. Ä. → Web-Speech-Fallback versuchen
      if (speechRecognitionCtor()) startWebSpeech();
      else onError(t('chat.micError'));
    }
  };

  useEffect(() => {
    if (autoStartSignal > 0 && state === 'idle' && !disabled) void toggle();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur das Signal soll triggern
  }, [autoStartSignal]);

  const label = state === 'recording' ? t('chat.micStop') : t('chat.micStart');

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={disabled || state === 'processing'}
      aria-label={label}
      title={state === 'processing' ? t('chat.micProcessing') : label}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors ${
        state === 'recording'
          ? 'animate-pulse border-red-500 bg-red-500/10 text-red-600 dark:text-red-400'
          : 'border-surface-300 text-surface-700 hover:border-accent-500 hover:text-accent-700 dark:border-surface-700 dark:text-surface-300 dark:hover:text-accent-400'
      } disabled:opacity-50`}
    >
      {state === 'processing' ? (
        <span className="text-xs" aria-hidden>
          …
        </span>
      ) : (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
          <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" />
          <path d="M18 11a1 1 0 1 0-2 0 4 4 0 0 1-8 0 1 1 0 1 0-2 0 6 6 0 0 0 5 5.92V19H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.08A6 6 0 0 0 18 11Z" />
        </svg>
      )}
    </button>
  );
}
