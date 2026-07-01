import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import type { SpeechRequest } from '@daemonai/shared';
import { userFromApiEvent } from '../lib/auth';
import { errorResponse, HttpError, parseJsonBody } from '../lib/http';
import { speechService } from '../services/SpeechService';

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  try {
    userFromApiEvent(event);
    const { text } = parseJsonBody<SpeechRequest>(event.body);
    if (typeof text !== 'string' || !text.trim()) {
      throw new HttpError(400, 'text ist erforderlich');
    }

    const audio = await speechService.synthesize(text);
    return {
      statusCode: 200,
      headers: { 'content-type': 'audio/mpeg', 'cache-control': 'no-store' },
      body: Buffer.from(audio).toString('base64'),
      isBase64Encoded: true,
    };
  } catch (err) {
    return errorResponse(err);
  }
};
