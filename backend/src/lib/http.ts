import type { APIGatewayProxyResultV2 } from 'aws-lambda';

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function json(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export function errorResponse(err: unknown): APIGatewayProxyResultV2 {
  if (err instanceof HttpError) {
    return json(err.statusCode, { message: err.message });
  }
  console.error(err);
  return json(500, { message: 'Interner Fehler' });
}

export function parseJsonBody<T>(body: string | undefined): T {
  if (!body) return {} as T;
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new HttpError(400, 'Ungültiger JSON-Body');
  }
}

export function requirePathParam(
  params: Record<string, string | undefined> | undefined,
  name: string
): string {
  const value = params?.[name];
  if (!value) throw new HttpError(400, `Pfadparameter "${name}" fehlt`);
  return value;
}
