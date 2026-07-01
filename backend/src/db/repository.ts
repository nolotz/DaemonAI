import {
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import type {
  ChatMessage,
  Entry,
  Insight,
  InsightPeriod,
  Session,
  SessionStatus,
  UserProfile,
} from '@daemonai/shared';
import { config } from '../config';
import { docClient } from './client';
import { keys } from './keys';

type Item = Record<string, unknown>;

function strip<T>(item: Item): T {
  const { PK: _pk, SK: _sk, ...rest } = item;
  return rest as T;
}

// ─── Profil ──────────────────────────────────────────────────────────────────

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const res = await docClient.send(
    new GetCommand({
      TableName: config.tableName,
      Key: { PK: keys.userPk(userId), SK: keys.profileSk() },
    })
  );
  return res.Item ? strip<UserProfile>(res.Item) : null;
}

export async function putProfile(profile: UserProfile): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: config.tableName,
      Item: { PK: keys.userPk(profile.userId), SK: keys.profileSk(), ...profile },
    })
  );
}

/** Entfernt den Active-Session-Zeiger nur, wenn er noch auf diese Session zeigt. */
export async function clearActiveSession(userId: string, sessionId: string): Promise<void> {
  try {
    await docClient.send(
      new UpdateCommand({
        TableName: config.tableName,
        Key: { PK: keys.userPk(userId), SK: keys.profileSk() },
        UpdateExpression: 'REMOVE activeSessionId',
        ConditionExpression: 'activeSessionId = :sid',
        ExpressionAttributeValues: { ':sid': sessionId },
      })
    );
  } catch (err) {
    if ((err as { name?: string }).name !== 'ConditionalCheckFailedException') throw err;
  }
}

// ─── Sessions & Nachrichten ──────────────────────────────────────────────────

export async function createSession(session: Session): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: config.tableName,
      Item: { PK: keys.userPk(session.userId), SK: keys.sessionSk(session.sessionId), ...session },
      ConditionExpression: 'attribute_not_exists(SK)',
    })
  );
}

export async function getSession(userId: string, sessionId: string): Promise<Session | null> {
  const res = await docClient.send(
    new GetCommand({
      TableName: config.tableName,
      Key: { PK: keys.userPk(userId), SK: keys.sessionSk(sessionId) },
    })
  );
  return res.Item ? strip<Session>(res.Item) : null;
}

export async function listSessions(userId: string, limit = 50): Promise<Session[]> {
  const res = await docClient.send(
    new QueryCommand({
      TableName: config.tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': keys.userPk(userId),
        ':prefix': keys.sessionPrefix(),
      },
      ScanIndexForward: false, // ULIDs im SK ⇒ neueste zuerst
      Limit: limit,
    })
  );
  return (res.Items ?? []).map((i) => strip<Session>(i));
}

/**
 * Nachricht anhängen und den Zähler der Session fortschreiben – als Transaktion
 * mit Bedingung auf dem alten Zählerstand, damit parallele Requests keine
 * Sequenznummer doppelt vergeben.
 */
export async function appendMessage(
  userId: string,
  message: ChatMessage,
  expectedMessageCount: number
): Promise<void> {
  await docClient.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: config.tableName,
            Item: {
              PK: keys.messagePk(message.sessionId),
              SK: keys.messageSk(message.seq),
              userId,
              ...message,
            },
            ConditionExpression: 'attribute_not_exists(SK)',
          },
        },
        {
          Update: {
            TableName: config.tableName,
            Key: { PK: keys.userPk(userId), SK: keys.sessionSk(message.sessionId) },
            UpdateExpression: 'SET messageCount = :new, updatedAt = :now',
            ConditionExpression: 'messageCount = :expected',
            ExpressionAttributeValues: {
              ':new': message.seq,
              ':expected': expectedMessageCount,
              ':now': message.createdAt,
            },
          },
        },
      ],
    })
  );
}

export async function listMessages(sessionId: string): Promise<ChatMessage[]> {
  const res = await docClient.send(
    new QueryCommand({
      TableName: config.tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: { ':pk': keys.messagePk(sessionId), ':prefix': 'MSG#' },
    })
  );
  return (res.Items ?? []).map((i) => strip<ChatMessage>(i));
}

/** Eintrag anlegen und Session abschließen – atomar. */
export async function completeSessionWithEntry(entry: Entry, status: SessionStatus): Promise<void> {
  await docClient.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: config.tableName,
            Item: { PK: keys.userPk(entry.userId), SK: keys.entrySk(entry.date, entry.entryId), ...entry },
          },
        },
        {
          Update: {
            TableName: config.tableName,
            Key: { PK: keys.userPk(entry.userId), SK: keys.sessionSk(entry.sessionId) },
            UpdateExpression:
              'SET #status = :status, entryId = :entryId, entryDate = :entryDate, updatedAt = :now',
            ConditionExpression: '#status = :active',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: {
              ':status': status,
              ':active': 'active',
              ':entryId': entry.entryId,
              ':entryDate': entry.date,
              ':now': entry.createdAt,
            },
          },
        },
      ],
    })
  );
}

// ─── Einträge ────────────────────────────────────────────────────────────────

export async function listEntriesByDateRange(
  userId: string,
  fromDate: string,
  toDate: string
): Promise<Entry[]> {
  const range = keys.entryRange(fromDate, toDate);
  const res = await docClient.send(
    new QueryCommand({
      TableName: config.tableName,
      KeyConditionExpression: 'PK = :pk AND SK BETWEEN :from AND :to',
      ExpressionAttributeValues: {
        ':pk': keys.userPk(userId),
        ':from': range.from,
        ':to': range.to,
      },
      ScanIndexForward: false,
    })
  );
  return (res.Items ?? []).map((i) => strip<Entry>(i));
}

export async function getEntry(
  userId: string,
  date: string,
  entryId: string
): Promise<Entry | null> {
  const res = await docClient.send(
    new GetCommand({
      TableName: config.tableName,
      Key: { PK: keys.userPk(userId), SK: keys.entrySk(date, entryId) },
    })
  );
  return res.Item ? strip<Entry>(res.Item) : null;
}

// ─── Insight-Cache ───────────────────────────────────────────────────────────

export async function getInsight(
  userId: string,
  period: InsightPeriod,
  key: string
): Promise<Insight | null> {
  const res = await docClient.send(
    new GetCommand({
      TableName: config.tableName,
      Key: { PK: keys.userPk(userId), SK: keys.insightSk(period, key) },
    })
  );
  return res.Item ? strip<Insight>(res.Item) : null;
}

export async function putInsight(userId: string, insight: Insight): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: config.tableName,
      Item: { PK: keys.userPk(userId), SK: keys.insightSk(insight.period, insight.key), ...insight },
    })
  );
}
