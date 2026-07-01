import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserPool,
  type CognitoUserSession,
} from 'amazon-cognito-identity-js';
import { config } from '../config';

const pool = new CognitoUserPool({
  UserPoolId: config.userPoolId,
  ClientId: config.clientId,
});

const userFor = (email: string) => new CognitoUser({ Username: email, Pool: pool });

export function signUp(email: string, password: string): Promise<void> {
  return new Promise((resolve, reject) => {
    pool.signUp(
      email,
      password,
      [new CognitoUserAttribute({ Name: 'email', Value: email })],
      [],
      (err) => (err ? reject(err) : resolve())
    );
  });
}

export function confirmSignUp(email: string, code: string): Promise<void> {
  return new Promise((resolve, reject) => {
    userFor(email).confirmRegistration(code, true, (err) => (err ? reject(err) : resolve()));
  });
}

export function signIn(email: string, password: string): Promise<void> {
  return new Promise((resolve, reject) => {
    userFor(email).authenticateUser(
      new AuthenticationDetails({ Username: email, Password: password }),
      {
        onSuccess: () => resolve(),
        onFailure: reject,
      }
    );
  });
}

export function signOut(): void {
  pool.getCurrentUser()?.signOut();
}

function currentSession(): Promise<CognitoUserSession | null> {
  return new Promise((resolve) => {
    const user = pool.getCurrentUser();
    if (!user) return resolve(null);
    // getSession erneuert abgelaufene Tokens automatisch über das Refresh-Token
    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      resolve(err || !session?.isValid() ? null : session);
    });
  });
}

export async function currentUserEmail(): Promise<string | null> {
  const session = await currentSession();
  return session ? ((session.getIdToken().payload.email as string) ?? null) : null;
}

/** ID-Token für API-Aufrufe; null, wenn nicht (mehr) angemeldet. */
export async function getIdToken(): Promise<string | null> {
  const session = await currentSession();
  return session?.getIdToken().getJwtToken() ?? null;
}
