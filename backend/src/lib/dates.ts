const DAY_MS = 86_400_000;

/** Kalendertag der Nutzer (Europe/Berlin) als YYYY-MM-DD. */
export function berlinToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(now);
}

function toUtc(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(dateStr: string, days: number): string {
  return toDateStr(new Date(toUtc(dateStr).getTime() + days * DAY_MS));
}

export interface PeriodInfo {
  key: string;
  from: string;
  to: string;
}

/** ISO-8601-Woche (Montag–Sonntag), Key z. B. "2026-W27". */
export function weekInfo(dateStr: string): PeriodInfo {
  const date = toUtc(dateStr);
  const dayNum = (date.getUTCDay() + 6) % 7; // Montag = 0
  const monday = new Date(date.getTime() - dayNum * DAY_MS);

  // ISO-Wochennummer über den Donnerstag der Woche
  const thursday = new Date(monday.getTime() + 3 * DAY_MS);
  const isoYear = thursday.getUTCFullYear();
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4Monday = new Date(jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * DAY_MS);
  const week = 1 + Math.round((monday.getTime() - jan4Monday.getTime()) / (7 * DAY_MS));

  return {
    key: `${isoYear}-W${String(week).padStart(2, '0')}`,
    from: toDateStr(monday),
    to: toDateStr(new Date(monday.getTime() + 6 * DAY_MS)),
  };
}

/** Kalendermonat, Key z. B. "2026-07". */
export function monthInfo(dateStr: string): PeriodInfo {
  const [y, m] = dateStr.split('-').map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1));
  const to = new Date(Date.UTC(y, m, 0)); // Tag 0 des Folgemonats = letzter Tag
  return {
    key: `${y}-${String(m).padStart(2, '0')}`,
    from: toDateStr(from),
    to: toDateStr(to),
  };
}

/** Alle Kalendertage von from bis to (inklusiv). */
export function daysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  for (let t = toUtc(from).getTime(); t <= toUtc(to).getTime(); t += DAY_MS) {
    days.push(toDateStr(new Date(t)));
  }
  return days;
}
