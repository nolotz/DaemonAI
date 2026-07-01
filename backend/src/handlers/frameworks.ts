import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { listFrameworks } from '../frameworks/registry';
import { userFromApiEvent } from '../lib/auth';
import { errorResponse, json } from '../lib/http';

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  try {
    userFromApiEvent(event);
    return json(200, { frameworks: listFrameworks() });
  } catch (err) {
    return errorResponse(err);
  }
};
