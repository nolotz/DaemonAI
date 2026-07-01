import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Entry, ListEntriesResponse } from '@daemonai/shared';
import { api } from '../lib/api';

function formatDate(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00`));
}

export function HistoryPage() {
  const { t, i18n } = useTranslation();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    api<ListEntriesResponse>('/entries', { query: { q: search || undefined } })
      .then((res) => setEntries(res.entries))
      .catch((err) => setError((err as Error).message));
  }, [search]);

  const byDate = useMemo(() => {
    const groups = new Map<string, Entry[]>();
    for (const entry of entries ?? []) {
      groups.set(entry.date, [...(groups.get(entry.date) ?? []), entry]);
    }
    return [...groups.entries()]; // Query liefert bereits absteigend sortiert
  }, [entries]);

  return (
    <div>
      <h1 className="text-xl font-semibold">{t('history.title')}</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(query.trim());
        }}
        className="mt-4"
      >
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!e.target.value) setSearch('');
          }}
          placeholder={t('history.searchPlaceholder')}
          className="w-full rounded-xl border border-surface-300 bg-white px-3 py-2 outline-none focus:border-accent-500 dark:border-surface-700 dark:bg-surface-900"
        />
      </form>

      {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {entries === null && !error && (
        <p className="mt-8 text-center text-surface-700 dark:text-surface-300">
          {t('common.loading')}
        </p>
      )}
      {entries?.length === 0 && (
        <p className="mt-8 text-center text-surface-700 dark:text-surface-300">
          {search ? t('history.noResults') : t('history.empty')}
        </p>
      )}

      <div className="mt-6 space-y-8">
        {byDate.map(([date, dayEntries]) => (
          <section key={date}>
            <h2 className="text-sm font-medium text-surface-700 dark:text-surface-300">
              {formatDate(date, i18n.language)}
            </h2>
            <div className="mt-2 space-y-3">
              {dayEntries.map((entry) => (
                <article
                  key={entry.entryId}
                  className="rounded-xl border border-surface-200 bg-white p-4 dark:border-surface-800 dark:bg-surface-900"
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{entry.text}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-surface-700 dark:text-surface-300">
                    {entry.mood !== null && (
                      <span>
                        {t('history.mood')}: {entry.mood}/10
                      </span>
                    )}
                    {entry.topics.map((topic) => (
                      <span
                        key={topic}
                        className="rounded-full bg-surface-100 px-2 py-0.5 dark:bg-surface-800"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
