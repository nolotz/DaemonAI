import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import * as repo from '../src/db/repository';

const ddb = mockClient(DynamoDBDocumentClient);

beforeEach(() => ddb.reset());

describe('repository', () => {
  it('lädt das Profil unter USER#<sub>/PROFILE und entfernt die Key-Attribute', async () => {
    ddb.on(GetCommand).resolves({
      Item: { PK: 'USER#u1', SK: 'PROFILE', userId: 'u1', email: 'a@b.de' },
    });

    const profile = await repo.getProfile('u1');

    expect(ddb.commandCalls(GetCommand)[0].args[0].input.Key).toEqual({
      PK: 'USER#u1',
      SK: 'PROFILE',
    });
    expect(profile).toEqual({ userId: 'u1', email: 'a@b.de' });
  });

  it('listet Sessions nur des angegebenen Nutzers, neueste zuerst', async () => {
    ddb.on(QueryCommand).resolves({ Items: [] });

    await repo.listSessions('u1');

    const input = ddb.commandCalls(QueryCommand)[0].args[0].input;
    expect(input.KeyConditionExpression).toContain('begins_with');
    expect(input.ExpressionAttributeValues).toMatchObject({
      ':pk': 'USER#u1',
      ':prefix': 'SESSION#',
    });
    expect(input.ScanIndexForward).toBe(false);
  });

  it('fragt Einträge als Datumsbereich innerhalb der Nutzer-Partition ab', async () => {
    ddb.on(QueryCommand).resolves({ Items: [] });

    await repo.listEntriesByDateRange('u1', '2026-06-01', '2026-06-30');

    const input = ddb.commandCalls(QueryCommand)[0].args[0].input;
    expect(input.KeyConditionExpression).toContain('BETWEEN');
    expect(input.ExpressionAttributeValues).toMatchObject({
      ':pk': 'USER#u1',
      ':from': 'ENTRY#2026-06-01',
      ':to': 'ENTRY#2026-06-30$',
    });
  });

  it('liefert null für nicht existierende Sessions (kein Durchgriff auf fremde Daten)', async () => {
    ddb.on(GetCommand).resolves({});
    expect(await repo.getSession('u1', 'fremde-session')).toBeNull();
  });
});
