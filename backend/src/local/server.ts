/**
 * Lokaler Dev-Server: bildet API Gateway (HTTP API) und die Streaming-
 * Function-URL auf einem Port nach, damit das Frontend gegen echte Handler
 * entwickelt werden kann. Auth läuft gegen den echten Cognito-Dev-Pool –
 * es gibt bewusst keinen Auth-Bypass.
 *
 * Start: npm run dev  (liest backend/.env)
 */
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { handleChatStream } from '../handlers/chat';
import { verifyBearer } from '../lib/auth';

// ── Mini-Dotenv (keine Abhängigkeit nötig) ───────────────────────────────────
const envFile = path.join(__dirname, '..', '..', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !(match[1] in process.env)) process.env[match[1]] = match[2];
  }
}

type LambdaHandler = (event: APIGatewayProxyEventV2WithJWTAuthorizer) => Promise<
  | {
      statusCode?: number;
      headers?: Record<string, unknown>;
      body?: string;
      isBase64Encoded?: boolean;
    }
  | string
>;

interface Route {
  method: string;
  pattern: string;
  regex: RegExp;
  params: string[];
  load: () => Promise<{ handler: LambdaHandler }>;
}

function route(method: string, pattern: string, load: Route['load']): Route {
  const params: string[] = [];
  const regex = new RegExp(
    `^${pattern.replace(/\{([^}]+)\}/g, (_, name: string) => {
      params.push(name);
      return '([^/]+)';
    })}$`
  );
  return { method, pattern, regex, params, load };
}

const routes: Route[] = [
  route('GET', '/me', () => import('../handlers/profile')),
  route('PUT', '/me', () => import('../handlers/profile')),
  route('GET', '/frameworks', () => import('../handlers/frameworks')),
  route('POST', '/sessions', () => import('../handlers/sessions')),
  route('GET', '/sessions', () => import('../handlers/sessions')),
  route('GET', '/sessions/{id}', () => import('../handlers/sessions')),
  route('POST', '/sessions/{id}/complete', () => import('../handlers/sessions')),
  route('GET', '/entries', () => import('../handlers/entries')),
  route('GET', '/entries/{date}/{id}', () => import('../handlers/entries')),
  route('GET', '/insights', () => import('../handlers/insights')),
  route('POST', '/speech', () => import('../handlers/speech')),
  route('POST', '/transcriptions', () => import('../handlers/transcription')),
  route('POST', '/transcriptions/{id}/start', () => import('../handlers/transcription')),
  route('GET', '/transcriptions/{id}', () => import('../handlers/transcription')),
];

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'access-control-allow-headers': 'authorization,content-type',
};

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const method = req.method ?? 'GET';

  if (method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS).end();
    return;
  }

  const body = await readBody(req);
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === 'string') headers[k.toLowerCase()] = v;
  }

  try {
    // Streaming-Chat: entspricht der Lambda-Function-URL
    if (method === 'POST' && url.pathname === '/chat') {
      res.writeHead(200, {
        ...CORS_HEADERS,
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
      });
      await handleChatStream(
        { headers, body },
        { write: (chunk) => res.write(chunk), end: () => res.end() }
      );
      return;
    }

    const match = routes
      .filter((r) => r.method === method)
      .map((r) => ({ r, m: url.pathname.match(r.regex) }))
      .find((x) => x.m);

    if (!match?.m) {
      res.writeHead(404, { ...CORS_HEADERS, 'content-type': 'application/json' });
      res.end(JSON.stringify({ message: 'Route nicht gefunden' }));
      return;
    }

    // Wie in der Cloud: verifiziertes Cognito-JWT, Claims in den Event-Kontext
    const user = await verifyBearer(headers.authorization);
    const pathParameters = Object.fromEntries(
      match.r.params.map((name, i) => [name, decodeURIComponent(match.m![i + 1])])
    );

    const event = {
      version: '2.0',
      routeKey: `${method} ${match.r.pattern}`,
      rawPath: url.pathname,
      headers,
      body: body || undefined,
      pathParameters,
      queryStringParameters: Object.fromEntries(url.searchParams.entries()),
      requestContext: {
        http: { method, path: url.pathname },
        authorizer: { jwt: { claims: { sub: user.sub, email: user.email } } },
      },
    } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;

    const { handler } = await match.r.load();
    const result = await handler(event);
    const normalized = typeof result === 'string' ? { statusCode: 200, body: result } : result;

    res.writeHead(normalized.statusCode ?? 200, {
      ...CORS_HEADERS,
      ...(normalized.headers as Record<string, string>),
    });
    // Binärantworten (z. B. Polly-MP3) kommen wie bei API Gateway base64-kodiert
    res.end(
      normalized.isBase64Encoded ? Buffer.from(normalized.body ?? '', 'base64') : normalized.body ?? ''
    );
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) console.error(err);
    res.writeHead(status, { ...CORS_HEADERS, 'content-type': 'application/json' });
    res.end(JSON.stringify({ message: (err as Error).message ?? 'Interner Fehler' }));
  }
});

const port = Number(process.env.PORT ?? 3001);
server.listen(port, () => {
  console.log(`DaemonAI-Backend lokal auf http://localhost:${port}`);
  console.log(`Chat-Stream:  POST http://localhost:${port}/chat`);
});
