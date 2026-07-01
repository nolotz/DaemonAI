import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { userFromApiEvent } from '../lib/auth';
import { errorResponse, HttpError, json, parseJsonBody, requirePathParam } from '../lib/http';
import { transcriptionService } from '../services/TranscriptionService';

interface TranscriptionBody {
  contentType?: string;
}

function requireContentType(body: string | undefined): string {
  const { contentType } = parseJsonBody<TranscriptionBody>(body);
  if (!contentType) throw new HttpError(400, 'contentType ist erforderlich');
  return contentType;
}

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  try {
    const user = userFromApiEvent(event);

    switch (event.routeKey) {
      case 'POST /transcriptions':
        return json(201, await transcriptionService.create(user.sub, requireContentType(event.body)));
      case 'POST /transcriptions/{id}/start': {
        const id = requirePathParam(event.pathParameters, 'id');
        await transcriptionService.start(user.sub, id, requireContentType(event.body));
        return json(202, { transcriptionId: id, status: 'processing' });
      }
      case 'GET /transcriptions/{id}': {
        const id = requirePathParam(event.pathParameters, 'id');
        return json(200, await transcriptionService.status(user.sub, id));
      }
      default:
        throw new HttpError(404, 'Route nicht gefunden');
    }
  } catch (err) {
    return errorResponse(err);
  }
};
