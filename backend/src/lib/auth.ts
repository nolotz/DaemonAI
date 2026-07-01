import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { config } from '../config';
import { HttpError } from './http';

export interface AuthUser {
  sub: string;
  email: string;
}

type JwtClaims = Record<string, unknown> | undefined;

/** Für Routen hinter dem HTTP-API-JWT-Authorizer: Claims sind bereits verifiziert. */
export function userFromApiEvent(event: {
  requestContext?: { authorizer?: { jwt?: { claims?: JwtClaims } } };
}): AuthUser {
  const claims = event.requestContext?.authorizer?.jwt?.claims;
  const sub = claims?.sub;
  if (typeof sub !== 'string' || !sub) {
    throw new HttpError(401, 'Nicht autorisiert');
  }
  return { sub, email: typeof claims?.email === 'string' ? claims.email : '' };
}

let verifier: ReturnType<typeof CognitoJwtVerifier.create> | undefined;

/**
 * Für die Streaming-Function-URL: dort gibt es keinen Gateway-Authorizer,
 * das ID-Token wird hier selbst gegen den User Pool geprüft.
 */
export async function verifyBearer(authHeader: string | undefined): Promise<AuthUser> {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new HttpError(401, 'Bearer-Token fehlt');
  }
  verifier ??= CognitoJwtVerifier.create({
    userPoolId: config.userPoolId,
    tokenUse: 'id',
    clientId: config.userPoolClientId,
  });
  try {
    const payload = await verifier.verify(authHeader.slice('Bearer '.length));
    return {
      sub: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : '',
    };
  } catch {
    throw new HttpError(401, 'Ungültiger oder abgelaufener Token');
  }
}
