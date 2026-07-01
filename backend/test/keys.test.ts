import { describe, expect, it } from 'vitest';
import { keys } from '../src/db/keys';

describe('DynamoDB-Key-Design', () => {
  it('trennt Nutzerdaten über den USER#-Präfix', () => {
    expect(keys.userPk('abc')).toBe('USER#abc');
    expect(keys.userPk('abc')).not.toBe(keys.userPk('abd'));
  });

  it('sortiert Nachrichten über 6-stellige Sequenznummern lexikografisch korrekt', () => {
    expect(keys.messageSk(1)).toBe('MSG#000001');
    expect(keys.messageSk(12)).toBe('MSG#000012');
    // Ohne Padding käme MSG#10 vor MSG#2
    expect(keys.messageSk(2) < keys.messageSk(10)).toBe(true);
  });

  it('schließt beim Entry-Datumsbereich den kompletten Endtag ein', () => {
    const { from, to } = keys.entryRange('2026-06-01', '2026-06-30');
    const entryOnLastDay = keys.entrySk('2026-06-30', '01JZZZZZZZZZZZZZZZZZZZZZZZ');
    const entryNextDay = keys.entrySk('2026-07-01', '01J0000000000000000000000');

    expect(entryOnLastDay >= from && entryOnLastDay <= to).toBe(true);
    expect(entryNextDay > to).toBe(true);
  });

  it('bildet Insight-Keys für Woche und Monat', () => {
    expect(keys.insightSk('week', '2026-W27')).toBe('INSIGHT#WEEK#2026-W27');
    expect(keys.insightSk('month', '2026-07')).toBe('INSIGHT#MONTH#2026-07');
  });
});
