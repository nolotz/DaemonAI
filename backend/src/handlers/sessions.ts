import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import type { SessionDetailResponse, StartSessionRequest } from '@daemonai/shared';
import * as repo from '../db/repository';
import { userFromApiEvent } from '../lib/auth';
import { errorResponse, HttpError, json, parseJsonBody, requirePathParam } from '../lib/http';
import { entryService } from '../services/EntryService';
import { interviewService } from '../services/InterviewService';

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  try {
    const user = userFromApiEvent(event);

    switch (event.routeKey) {
      case 'POST /sessions': {
        const body = parseJsonBody<StartSessionRequest>(event.body);
        return json(201, await interviewService.startSession(user.sub, user.email, body.framework));
      }
      case 'GET /sessions':
        return json(200, { sessions: await repo.listSessions(user.sub) });
      case 'GET /sessions/{id}': {
        const sessionId = requirePathParam(event.pathParameters, 'id');
        const session = await interviewService.requireOwnSession(user.sub, sessionId);
        const messages = await repo.listMessages(sessionId);
        const detail: SessionDetailResponse = { session, messages };
        return json(200, detail);
      }
      case 'POST /sessions/{id}/complete': {
        const sessionId = requirePathParam(event.pathParameters, 'id');
        const entry = await entryService.completeSession(user.sub, sessionId);
        return json(200, { entry });
      }
      default:
        throw new HttpError(404, 'Route nicht gefunden');
    }
  } catch (err) {
    return errorResponse(err);
  }
};
