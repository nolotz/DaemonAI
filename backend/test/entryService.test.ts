import { describe, expect, it } from 'vitest';
import { buildTranscript, parseSummary } from '../src/services/EntryService';

describe('parseSummary', () => {
  it('parst sauberes JSON', () => {
    const result = parseSummary(
      '{"text": "Heute war ein guter Tag.", "mood": 8, "topics": ["Arbeit", "Sport"]}'
    );
    expect(result).toEqual({
      text: 'Heute war ein guter Tag.',
      mood: 8,
      topics: ['Arbeit', 'Sport'],
    });
  });

  it('parst JSON mit umgebendem Text oder Markdown', () => {
    const raw = 'Hier ist der Eintrag:\n```json\n{"text": "Ein Tag.", "mood": 5, "topics": []}\n```';
    expect(parseSummary(raw)).toEqual({ text: 'Ein Tag.', mood: 5, topics: [] });
  });

  it('verwirft Stimmungswerte außerhalb von 1–10', () => {
    expect(parseSummary('{"text": "x", "mood": 42, "topics": []}').mood).toBeNull();
    expect(parseSummary('{"text": "x", "mood": 0, "topics": []}').mood).toBeNull();
  });

  it('rundet Kommazahlen bei der Stimmung', () => {
    expect(parseSummary('{"text": "x", "mood": 7.6, "topics": []}').mood).toBe(8);
  });

  it('filtert kaputte topics und begrenzt auf 8', () => {
    const raw = `{"text": "x", "mood": 5, "topics": ["a", 3, " b ", "", "c","d","e","f","g","h","i"]}`;
    expect(parseSummary(raw).topics).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
  });

  it('fällt bei unparsebarer Antwort auf den Rohtext zurück – nichts geht verloren', () => {
    const result = parseSummary('Heute war ein Tag ohne { gültiges JSON');
    expect(result.text).toBe('Heute war ein Tag ohne { gültiges JSON');
    expect(result.mood).toBeNull();
    expect(result.topics).toEqual([]);
  });
});

describe('buildTranscript', () => {
  it('kennzeichnet die Sprecher deutsch', () => {
    const transcript = buildTranscript([
      { role: 'assistant', content: 'Wie war dein Tag?' },
      { role: 'user', content: 'Gut.' },
    ]);
    expect(transcript).toBe('Interviewer: Wie war dein Tag?\n\nNutzer: Gut.');
  });
});
