import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { userFromApiEvent } from '../lib/auth';
import { berlinToday } from '../lib/dates';
import { errorResponse, HttpError, json } from '../lib/http';
import { insightService } from '../services/InsightService';

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  try {
    const user = userFromApiEvent(event);
    const params = event.queryStringParameters ?? {};

    const period = params.period ?? 'week';
    if (period !== 'week' && period !== 'month') {
      throw new HttpError(400, 'period muss "week" oder "month" sein');
    }
    const date = params.date ?? berlinToday();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new HttpError(400, 'Ungültiges Datum (YYYY-MM-DD)');
    }

    return json(200, await insightService.getInsights(user.sub, period, date));
  } catch (err) {
    return errorResponse(err);
  }
};
