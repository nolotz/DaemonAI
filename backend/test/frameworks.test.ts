import { describe, expect, it } from 'vitest';
import {
  buildSummaryPrompt,
  buildSystemPrompt,
  DEFAULT_FRAMEWORK_ID,
  getFramework,
  listFrameworks,
} from '../src/frameworks/registry';

describe('FrameworkRegistry', () => {
  it('liefert die drei mitgelieferten Vorlagen', () => {
    const ids = listFrameworks().map((f) => f.id);
    expect(ids).toEqual(expect.arrayContaining(['socratic', 'oars', 'daily-review']));
    expect(ids).toHaveLength(3);
  });

  it('hat für jede Vorlage alle Pflichtfelder gefüllt', () => {
    for (const { id } of listFrameworks()) {
      const fw = getFramework(id);
      expect(fw, id).toBeDefined();
      expect(fw!.name.length).toBeGreaterThan(0);
      expect(fw!.openingQuestion.length).toBeGreaterThan(0);
      expect(fw!.systemPrompt.length).toBeGreaterThan(0);
      expect(fw!.summaryPrompt.length).toBeGreaterThan(0);
      expect(fw!.phases.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('kennt das Default-Framework', () => {
    expect(getFramework(DEFAULT_FRAMEWORK_ID)).toBeDefined();
  });

  it('gibt undefined für unbekannte Frameworks zurück', () => {
    expect(getFramework('gibt-es-nicht')).toBeUndefined();
  });

  it('baut den Systemprompt aus Vorlage, Phasen und Basisregeln', () => {
    const fw = getFramework('socratic')!;
    const prompt = buildSystemPrompt(fw);
    expect(prompt).toContain(fw.systemPrompt);
    expect(prompt).toContain('1. ' + fw.phases[0]);
    expect(prompt).toContain('ausschließlich auf Deutsch');
  });

  it('erzwingt in der Zusammenfassung ein JSON-Format mit text, mood und topics', () => {
    const prompt = buildSummaryPrompt(getFramework('daily-review')!);
    expect(prompt).toContain('"text"');
    expect(prompt).toContain('"mood"');
    expect(prompt).toContain('"topics"');
  });
});
