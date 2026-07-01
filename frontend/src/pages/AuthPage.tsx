import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import * as cognito from '../lib/cognito';

type Mode = 'signIn' | 'signUp' | 'confirm';

const inputClass =
  'w-full rounded-xl border border-surface-300 bg-white px-3 py-2 outline-none focus:border-accent-500 dark:border-surface-700 dark:bg-surface-900';

export function AuthPage() {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'signIn') {
        await signIn(email, password);
      } else if (mode === 'signUp') {
        await cognito.signUp(email, password);
        setMode('confirm');
      } else {
        await cognito.confirmSignUp(email, code);
        await signIn(email, password);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-2xl font-semibold tracking-tight">{t('app.name')}</h1>
        <p className="mt-1 text-center text-sm text-surface-700 dark:text-surface-300">
          {t('app.tagline')}
        </p>

        <form onSubmit={submit} className="mt-8 space-y-3">
          {mode === 'confirm' ? (
            <>
              <h2 className="font-medium">{t('auth.confirmTitle')}</h2>
              <p className="text-sm text-surface-700 dark:text-surface-300">
                {t('auth.confirmHint')}
              </p>
              <input
                className={inputClass}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={t('auth.code')}
                inputMode="numeric"
                autoComplete="one-time-code"
                required
              />
            </>
          ) : (
            <>
              <input
                className={inputClass}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('auth.email')}
                autoComplete="email"
                required
              />
              <input
                className={inputClass}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.password')}
                autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
                required
              />
              {mode === 'signUp' && (
                <p className="text-xs text-surface-700 dark:text-surface-300">
                  {t('auth.passwordHint')}
                </p>
              )}
            </>
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-accent-700 py-2 font-medium text-white hover:bg-accent-600 disabled:opacity-50"
          >
            {t(mode === 'signIn' ? 'auth.signIn' : mode === 'signUp' ? 'auth.signUp' : 'auth.confirm')}
          </button>
        </form>

        {mode !== 'confirm' && (
          <button
            className="mt-4 w-full text-sm text-accent-700 hover:underline dark:text-accent-400"
            onClick={() => {
              setError(null);
              setMode(mode === 'signIn' ? 'signUp' : 'signIn');
            }}
          >
            {t(mode === 'signIn' ? 'auth.toSignUp' : 'auth.toSignIn')}
          </button>
        )}
      </div>
    </div>
  );
}
