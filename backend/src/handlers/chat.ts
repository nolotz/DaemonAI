import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import type { ChatRequest, ChatStreamEvent } from '@daemonai/shared';
import { verifyBearer } from '../lib/auth';
import { HttpError } from '../lib/http';
import { interviewService } from '../services/InterviewService';

export interface SseWriter {
  write(chunk: string): void;
  end(): void;
}

function emit(writer: SseWriter, event: ChatStreamEvent): void {
  writer.write(`data: ${JSON.stringify(event)}\n\n`);
}

/**
 * Kern des Chat-Streams, unabhängig von der Lambda-Streaming-Laufzeit –
 * so kann der lokale Dev-Server dieselbe Logik ohne `awslambda`-Global nutzen.
 * Fehler werden als SSE-Event gemeldet, da der HTTP-Status beim Streaming
 * bereits gesendet ist.
 */
export async function handleChatStream(
  event: Pick<APIGatewayProxyEventV2, 'headers' | 'body'>,
  writer: SseWriter
): Promise<void> {
  try {
    const user = await verifyBearer(event.headers?.authorization);
    const { sessionId, message } = JSON.parse(event.body ?? '{}') as Partial<ChatRequest>;
    if (!sessionId || typeof message !== 'string') {
      throw new HttpError(400, 'sessionId und message sind erforderlich');
    }
    const result = await interviewService.chat(user.sub, sessionId, message, (delta) =>
      emit(writer, { type: 'delta', text: delta })
    );
    emit(writer, { type: 'done', messageSeq: result.seq });
  } catch (err) {
    if (!(err instanceof HttpError)) console.error(err);
    emit(writer, {
      type: 'error',
      message: err instanceof HttpError ? err.message : 'Interner Fehler',
    });
  } finally {
    writer.end();
  }
}

// Von der Lambda-Node-Laufzeit bereitgestellte Streaming-Globals
declare const awslambda:
  | {
      streamifyResponse(
        fn: (
          event: APIGatewayProxyEventV2,
          responseStream: NodeJS.WritableStream,
          context: unknown
        ) => Promise<void>
      ): unknown;
      HttpResponseStream: {
        from(
          stream: NodeJS.WritableStream,
          metadata: { statusCode: number; headers: Record<string, string> }
        ): NodeJS.WritableStream;
      };
    }
  | undefined;

export const handler =
  typeof awslambda !== 'undefined'
    ? awslambda.streamifyResponse(async (event, responseStream) => {
        const stream = awslambda.HttpResponseStream.from(responseStream, {
          statusCode: 200,
          headers: {
            'content-type': 'text/event-stream',
            'cache-control': 'no-cache',
          },
        });
        await handleChatStream(event, {
          write: (chunk) => stream.write(chunk),
          end: () => stream.end(),
        });
      })
    : undefined;
