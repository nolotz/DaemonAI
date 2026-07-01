import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Insight, InsightPeriod } from '@daemonai/shared';
import { MoodChart, TopicsChart } from '../components/charts';
import { api } from '../lib/api';

const today = () => new Date().toISOString().slice(0, 10);

function shiftDate(date: string, period: InsightPeriod, direction: 1 | -1): string {
  const d = new Date(`${date}T12:00:00Z`);
  if (period === 'week') d.setUTCDate(d.getUTCDate() + 7 * direction);
  else d.setUTCMonth(d.getUTCMonth() + direction);
  return d.toISOString().slice(0, 10);
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-surface-200 bg-white p-4 dark:border-surface-800 dark:bg-surface-900">
      <div className="text-sm text-surface-700 dark:text-surface-300">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

export function InsightsPage() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<InsightPeriod>('week');
  const [refDate, setRefDate] = useState(today());
  const [insight, setInsight] = useState<Insight | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setInsight(null);
    setError(null);
    api<Insight>('/insights', { query: { period, date: refDate } })
      .then(setInsight)
      .catch((err) => setError((err as Error).message));
  }, [period, refDate]);

  const periodButton = (value: InsightPeriod, label: string) => (
    <button
      onClick={() => setPeriod(value)}
      aria-pressed={period === value}
      className={`rounded-lg px-3 py-1.5 text-sm ${
        period === value
          ? 'bg-accent-700 font-medium text-white'
          : 'text-surface-700 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800'
      }`}
    >
      {label}
    </button>
  );

  const daysWithMood = insight?.moodByDay.filter((d) => d.mood !== null) ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t('insights.title')}</h1>
        <div className="flex items-center gap-1 rounded-xl border border-surface-200 p-1 dark:border-surface-800">
          {periodButton('week', t('insights.week'))}
          {periodButton('month', t('insights.month'))}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm text-surface-700 dark:text-surface-300">
        <button
          onClick={() => setRefDate(shiftDate(refDate, period, -1))}
          aria-label={t('insights.prevPeriod')}
          className="rounded-lg px-2 py-1 hover:bg-surface-100 dark:hover:bg-surface-800"
        >
          ←
        </button>
        <span>{insight ? `${insight.from} – ${insight.to}` : '…'}</span>
        <button
          onClick={() => setRefDate(shiftDate(refDate, period, 1))}
          aria-label={t('insights.nextPeriod')}
          className="rounded-lg px-2 py-1 hover:bg-surface-100 dark:hover:bg-surface-800"
        >
          →
        </button>
      </div>

      {error && <p className="mt-6 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {!insight && !error && (
        <p className="mt-8 text-center text-surface-700 dark:text-surface-300">
          {t('common.loading')}
        </p>
      )}

      {insight && insight.entryCount === 0 && (
        <p className="mt-8 text-center text-surface-700 dark:text-surface-300">
          {t('insights.empty')}
        </p>
      )}

      {insight && insight.entryCount > 0 && (
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <StatTile label={t('insights.entries')} value={String(insight.entryCount)} />
            <StatTile
              label={t('insights.avgMood')}
              value={insight.avgMood !== null ? `${insight.avgMood} / 10` : '–'}
            />
          </div>

          <section className="rounded-xl border border-surface-200 bg-white p-4 dark:border-surface-800 dark:bg-surface-900">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">{t('insights.moodTitle')}</h2>
              <button
                onClick={() => setShowTable((v) => !v)}
                className="text-sm text-surface-700 underline-offset-2 hover:underline dark:text-surface-300"
              >
                {showTable ? t('insights.showChart') : t('insights.showTable')}
              </button>
            </div>
            <div className="mt-3">
              {showTable ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-surface-700 dark:text-surface-300">
                      <th className="py-1 font-medium">{t('insights.tableDate')}</th>
                      <th className="py-1 font-medium">{t('insights.tableMood')}</th>
                    </tr>
                  </thead>
                  <tbody style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {daysWithMood.map((d) => (
                      <tr key={d.date} className="border-t border-surface-100 dark:border-surface-800">
                        <td className="py-1">{d.date}</td>
                        <td className="py-1">{d.mood}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <MoodChart data={insight.moodByDay} />
              )}
            </div>
          </section>

          {insight.topics.length > 0 && (
            <section className="rounded-xl border border-surface-200 bg-white p-4 dark:border-surface-800 dark:bg-surface-900">
              <h2 className="font-medium">{t('insights.topicsTitle')}</h2>
              <div className="mt-3">
                <TopicsChart data={insight.topics} />
              </div>
            </section>
          )}

          {insight.summary && (
            <section className="rounded-xl border border-surface-200 bg-white p-4 dark:border-surface-800 dark:bg-surface-900">
              <h2 className="font-medium">{t('insights.summaryTitle')}</h2>
              <p className="mt-2 leading-relaxed text-surface-700 dark:text-surface-300">
                {insight.summary}
              </p>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
