import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, monthInfo, weekInfo } from '../src/lib/dates';

describe('weekInfo (ISO 8601)', () => {
  it('berechnet eine Woche mitten im Jahr', () => {
    // 2026-07-02 ist ein Donnerstag; die Woche geht Mo 29.06. – So 05.07.
    expect(weekInfo('2026-07-02')).toEqual({
      key: '2026-W27',
      from: '2026-06-29',
      to: '2026-07-05',
    });
  });

  it('ordnet den Jahresanfang der richtigen ISO-Woche zu', () => {
    // 1. Januar 2026 ist ein Donnerstag ⇒ Woche 1 beginnt am 29.12.2025
    expect(weekInfo('2026-01-01')).toEqual({
      key: '2026-W01',
      from: '2025-12-29',
      to: '2026-01-04',
    });
  });

  it('ordnet einen Jahreswechsel-Freitag der Vorjahres-Woche 53 zu', () => {
    expect(weekInfo('2027-01-01').key).toBe('2026-W53');
  });
});

describe('monthInfo', () => {
  it('liefert Monatsgrenzen inklusive Schaltjahr-Februar', () => {
    expect(monthInfo('2026-07-15')).toEqual({
      key: '2026-07',
      from: '2026-07-01',
      to: '2026-07-31',
    });
    expect(monthInfo('2028-02-10').to).toBe('2028-02-29');
  });
});

describe('addDays / daysBetween', () => {
  it('rechnet über Monatsgrenzen', () => {
    expect(addDays('2026-06-30', 1)).toBe('2026-07-01');
    expect(addDays('2026-07-01', -1)).toBe('2026-06-30');
  });

  it('zählt alle Tage inklusive der Grenzen', () => {
    expect(daysBetween('2026-06-29', '2026-07-01')).toEqual([
      '2026-06-29',
      '2026-06-30',
      '2026-07-01',
    ]);
  });
});
