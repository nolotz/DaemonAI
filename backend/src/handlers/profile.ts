import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import type { UpdateProfileRequest } from '@daemonai/shared';
import { userFromApiEvent } from '../lib/auth';
import { errorResponse, HttpError, json, parseJsonBody } from '../lib/http';
import { ensureProfile, updateProfile } from '../services/ProfileService';

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  try {
    const user = userFromApiEvent(event);
    switch (event.requestContext.http.method) {
      case 'GET':
        return json(200, await ensureProfile(user.sub, user.email));
      case 'PUT': {
        const patch = parseJsonBody<UpdateProfileRequest>(event.body);
        return json(200, await updateProfile(user.sub, user.email, patch));
      }
      default:
        throw new HttpError(405, 'Methode nicht erlaubt');
    }
  } catch (err) {
    return errorResponse(err);
  }
};
