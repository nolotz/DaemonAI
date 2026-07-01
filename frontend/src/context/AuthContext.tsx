import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import * as cognito from '../lib/cognito';

interface AuthState {
  status: 'loading' | 'signedIn' | 'signedOut';
  email: string | null;
  signIn(email: string, password: string): Promise<void>;
  signOut(): void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState['status']>('loading');
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    void cognito.currentUserEmail().then((current) => {
      setEmail(current);
      setStatus(current ? 'signedIn' : 'signedOut');
    });
  }, []);

  const signIn = useCallback(async (userEmail: string, password: string) => {
    await cognito.signIn(userEmail, password);
    setEmail(userEmail);
    setStatus('signedIn');
  }, []);

  const signOut = useCallback(() => {
    cognito.signOut();
    setEmail(null);
    setStatus('signedOut');
  }, []);

  return (
    <AuthContext.Provider value={{ status, email, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth außerhalb des AuthProviders');
  return ctx;
}
