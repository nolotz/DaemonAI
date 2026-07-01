import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import {
  GetTranscriptionJobCommand,
  StartTranscriptionJobCommand,
  TranscribeClient,
  type MediaFormat,
} from '@aws-sdk/client-transcribe';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { CreateTranscriptionResponse, TranscriptionStatusResponse } from '@daemonai/shared';
import { ulid } from 'ulid';
import { config } from '../config';
import { HttpError } from '../lib/http';

const s3 = new S3Client({});
const transcribe = new TranscribeClient({});

const FORMAT_BY_CONTENT_TYPE: Record<string, MediaFormat> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'mp4',
  'audio/m4a': 'mp4',
  'audio/x-m4a': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/flac': 'flac',
};

function mediaFormat(contentType: string): MediaFormat {
  const format = FORMAT_BY_CONTENT_TYPE[contentType.split(';')[0].trim().toLowerCase()];
  if (!format) throw new HttpError(400, `Nicht unterstütztes Audioformat: ${contentType}`);
  return format;
}

const audioKey = (userId: string, id: string, format: MediaFormat) =>
  `audio/${userId}/${id}.${format}`;
const transcriptKey = (userId: string, id: string) => `transcripts/${userId}/${id}.json`;
const jobName = (id: string) => `daemonai-${config.stage}-${id}`;

export class TranscriptionService {
  /** Presigned-PUT, damit Audio nie durch die Lambda läuft. */
  async create(userId: string, contentType: string): Promise<CreateTranscriptionResponse> {
    const format = mediaFormat(contentType);
    const transcriptionId = ulid();
    const uploadUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: config.audioBucket,
        Key: audioKey(userId, transcriptionId, format),
        ContentType: contentType,
      }),
      { expiresIn: 300 }
    );
    return { transcriptionId, uploadUrl };
  }

  async start(userId: string, transcriptionId: string, contentType: string): Promise<void> {
    const format = mediaFormat(contentType);
    await transcribe.send(
      new StartTranscriptionJobCommand({
        TranscriptionJobName: jobName(transcriptionId),
        LanguageCode: 'de-DE',
        MediaFormat: format,
        Media: {
          MediaFileUri: `s3://${config.audioBucket}/${audioKey(userId, transcriptionId, format)}`,
        },
        OutputBucketName: config.audioBucket,
        OutputKey: transcriptKey(userId, transcriptionId),
      })
    );
  }

  async status(userId: string, transcriptionId: string): Promise<TranscriptionStatusResponse> {
    let job;
    try {
      const res = await transcribe.send(
        new GetTranscriptionJobCommand({ TranscriptionJobName: jobName(transcriptionId) })
      );
      job = res.TranscriptionJob;
    } catch (err) {
      if ((err as { name?: string }).name === 'NotFoundException') {
        return { transcriptionId, status: 'pending' };
      }
      throw err;
    }

    // Mandantentrennung: der Job muss auf das Audio dieses Nutzers zeigen
    if (!job?.Media?.MediaFileUri?.includes(`/audio/${userId}/`)) {
      throw new HttpError(404, 'Transkription nicht gefunden');
    }

    switch (job.TranscriptionJobStatus) {
      case 'COMPLETED':
        return {
          transcriptionId,
          status: 'completed',
          text: await this.readTranscript(userId, transcriptionId),
        };
      case 'FAILED':
        return { transcriptionId, status: 'failed', error: job.FailureReason };
      default:
        return { transcriptionId, status: 'processing' };
    }
  }

  private async readTranscript(userId: string, transcriptionId: string): Promise<string> {
    const res = await s3.send(
      new GetObjectCommand({
        Bucket: config.audioBucket,
        Key: transcriptKey(userId, transcriptionId),
      })
    );
    const body = await res.Body?.transformToString();
    const parsed = JSON.parse(body ?? '{}') as {
      results?: { transcripts?: Array<{ transcript?: string }> };
    };
    return parsed.results?.transcripts?.[0]?.transcript ?? '';
  }
}

export const transcriptionService = new TranscriptionService();
