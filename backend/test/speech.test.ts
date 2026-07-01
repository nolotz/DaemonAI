import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { describe, expect, it } from 'vitest';
import { handler } from '../src/handlers/speech';
import { clampSpeechText, MAX_SPEECH_CHARS } from '../src/services/SpeechService';

const event = (body: unknown, claims?: Record<string, string>) =>
  ({
    routeKey: 'POST /speech',
    body: JSON.stringify(body),
    requestContext: {
      http: { method: 'POST', path: '/speech' },
      ...(claims ? { authorizer: { jwt: { claims } } } : {}),
    },
  }) as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;

describe('clampSpeechText', () => {
  it('weist leeren Text ab', () => {
    expect(() => clampSpeechText('   ')).toThrowError();
  });

  it('kürzt auf das Polly-Limit', () => {
    expect(clampSpeechText('a'.repeat(MAX_SPEECH_CHARS + 500))).toHaveLength(MAX_SPEECH_CHARS);
  });

  it('lässt normalen Text unverändert', () => {
    expect(clampSpeechText(' Wie war dein Tag? ')).toBe('Wie war dein Tag?');
  });
});

describe('speech handler', () => {
  it('weist Requests ohne JWT-Claims mit 401 ab', async () => {
    expect(await handler(event({ text: 'Hallo' }))).toMatchObject({ statusCode: 401 });
  });

  it('weist fehlenden Text mit 400 ab, bevor Polly aufgerufen wird', async () => {
    expect(await handler(event({}, { sub: 'u1' }))).toMatchObject({ statusCode: 400 });
  });
});
