/**
 * Zentrales Key-Design der Single-Table `daemonai-{stage}`.
 *
 * | Entität   | PK                  | SK                            |
 * |-----------|---------------------|-------------------------------|
 * | Profil    | USER#<sub>          | PROFILE                       |
 * | Session   | USER#<sub>          | SESSION#<ulid>                |
 * | Message   | SESSION#<sessionId> | MSG#<seq, 6-stellig>          |
 * | Entry     | USER#<sub>          | ENTRY#<YYYY-MM-DD>#<ulid>     |
 * | Insight   | USER#<sub>          | INSIGHT#<WEEK|MONTH>#<key>    |
 *
 * ULIDs sortieren lexikografisch nach Erstellungszeit, daher liefern
 * Range-Queries auf dem SK Chronologie ohne extra Zeitstempel im Key.
 * Jeder Zugriff beginnt mit der userId aus dem verifizierten JWT –
 * Cross-User-Zugriffe sind damit strukturell ausgeschlossen.
 */
import type { InsightPeriod } from '@daemonai/shared';

export const keys = {
  userPk: (userId: string) => `USER#${userId}`,
  profileSk: () => 'PROFILE',

  sessionSk: (sessionId: string) => `SESSION#${sessionId}`,
  sessionPrefix: () => 'SESSION#',

  messagePk: (sessionId: string) => `SESSION#${sessionId}`,
  messageSk: (seq: number) => `MSG#${String(seq).padStart(6, '0')}`,

  entrySk: (date: string, entryId: string) => `ENTRY#${date}#${entryId}`,
  /** Range-Grenzen für Datumsabfragen: [from, to] inklusiv */
  entryRange: (fromDate: string, toDate: string) => ({
    from: `ENTRY#${fromDate}`,
    // '$' sortiert nach '#…<ulid>' und schließt damit den ganzen Endtag ein
    to: `ENTRY#${toDate}$`,
  }),

  insightSk: (period: InsightPeriod, key: string) =>
    `INSIGHT#${period === 'week' ? 'WEEK' : 'MONTH'}#${key}`,
};
