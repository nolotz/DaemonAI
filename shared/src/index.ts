/** Gemeinsame Typen für Frontend, Backend und Infra. */

export type FrameworkId = 'socratic' | 'oars' | 'daily-review' | (string & {});

export type ThemePreference = 'system' | 'light' | 'dark';

export interface UserSettings {
  theme: ThemePreference;
}

export interface UserProfile {
  userId: string;
  email: string;
  locale: string;
  framework: FrameworkId;
  settings: UserSettings;
  activeSessionId?: string;
  createdAt: string;
}

export type SessionStatus = 'active' | 'completed';

export interface Session {
  sessionId: string;
  userId: string;
  framework: FrameworkId;
  status: SessionStatus;
  messageCount: number;
  entryId?: string;
  entryDate?: string;
  createdAt: string;
  updatedAt: string;
}

export type MessageRole = 'user' | 'assistant';

export interface ChatMessage {
  sessionId: string;
  seq: number;
  role: MessageRole;
  content: string;
  createdAt: string;
}

export interface Entry {
  entryId: string;
  userId: string;
  sessionId: string;
  /** Kalendertag des Eintrags, YYYY-MM-DD */
  date: string;
  text: string;
  /** Stimmung 1 (sehr schlecht) … 10 (sehr gut), null wenn nicht bestimmbar */
  mood: number | null;
  topics: string[];
  createdAt: string;
}

export type InsightPeriod = 'week' | 'month';

export interface MoodPoint {
  date: string;
  mood: number | null;
}

export interface TopicCount {
  topic: string;
  count: number;
}

export interface Insight {
  period: InsightPeriod;
  /** ISO-Woche (2026-W27) oder Monat (2026-07) */
  key: string;
  from: string;
  to: string;
  entryCount: number;
  avgMood: number | null;
  moodByDay: MoodPoint[];
  topics: TopicCount[];
  summary: string | null;
  computedAt: string;
}

export interface FrameworkInfo {
  id: FrameworkId;
  name: string;
  description: string;
}

// ─── API-DTOs ────────────────────────────────────────────────────────────────

export interface StartSessionRequest {
  framework?: FrameworkId;
}

export interface StartSessionResponse {
  session: Session;
  openingQuestion: string;
}

export interface SessionDetailResponse {
  session: Session;
  messages: ChatMessage[];
}

export interface ChatRequest {
  sessionId: string;
  message: string;
}

/** SSE-Events des Chat-Streams */
export type ChatStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; messageSeq: number }
  | { type: 'error'; message: string };

export interface CompleteSessionResponse {
  entry: Entry;
}

export interface ListEntriesResponse {
  entries: Entry[];
}

export interface UpdateProfileRequest {
  framework?: FrameworkId;
  locale?: string;
  settings?: Partial<UserSettings>;
}

export interface SpeechRequest {
  /** Vorzulesender Text; Antwort ist audio/mpeg (Amazon Polly) */
  text: string;
}

export interface CreateTranscriptionResponse {
  transcriptionId: string;
  uploadUrl: string;
}

export type TranscriptionStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface TranscriptionStatusResponse {
  transcriptionId: string;
  status: TranscriptionStatus;
  text?: string;
  error?: string;
}
