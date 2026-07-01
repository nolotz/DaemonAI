import type { FrameworkId, FrameworkInfo } from '@daemonai/shared';
import dailyReview from './daily-review.json';
import oars from './oars.json';
import socratic from './socratic.json';

/** Deklarative Interview-Vorlage – neue Vorlage = neue JSON-Datei in diesem Ordner. */
export interface Framework {
  id: FrameworkId;
  name: string;
  description: string;
  openingQuestion: string;
  systemPrompt: string;
  phases: string[];
  summaryPrompt: string;
}

export const DEFAULT_FRAMEWORK_ID: FrameworkId = 'daily-review';

const frameworks = new Map<string, Framework>(
  [socratic, oars, dailyReview].map((f) => [f.id, f as Framework])
);

export function getFramework(id: FrameworkId): Framework | undefined {
  return frameworks.get(id);
}

export function listFrameworks(): FrameworkInfo[] {
  return [...frameworks.values()].map(({ id, name, description }) => ({ id, name, description }));
}

/** Regeln, die für jede Vorlage gelten – unabhängig von der Gesprächsführung. */
const BASE_RULES = `Allgemeine Regeln:
- Antworte ausschließlich auf Deutsch.
- Stelle genau eine Frage pro Nachricht.
- Halte deine Nachrichten kurz: höchstens zwei Sätze Einordnung plus eine Frage.
- Sei warm, ruhig und wertschätzend, ohne schwülstig zu werden.
- Stelle keine Diagnosen und gib keine medizinischen oder therapeutischen Ratschläge.
- Wenn der Nutzer das Gespräch beenden möchte, respektiere das sofort und schlage vor, die Session abzuschließen.`;

export function buildSystemPrompt(framework: Framework): string {
  const phaseList = framework.phases.map((p, i) => `${i + 1}. ${p}`).join('\n');
  return `${framework.systemPrompt}

Führe das Gespräch entlang dieser Phasen, ohne sie mechanisch abzuarbeiten – folge dem Nutzer, wenn er woanders hin will:
${phaseList}

${BASE_RULES}`;
}

/** Prompt für die Abschluss-Zusammenfassung; erzwingt strukturiertes JSON. */
export function buildSummaryPrompt(framework: Framework): string {
  return `${framework.summaryPrompt}

Antworte ausschließlich mit einem JSON-Objekt in genau dieser Form, ohne Markdown und ohne Text davor oder danach:
{"text": "<Tagebucheintrag auf Deutsch, 100 bis 400 Wörter, Ich-Perspektive>", "mood": <Gesamtstimmung des Nutzers als ganze Zahl von 1 (sehr schlecht) bis 10 (sehr gut)>, "topics": ["<2 bis 6 kurze deutsche Schlagworte>"]}`;
}
