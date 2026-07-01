import { PollyClient, SynthesizeSpeechCommand, type VoiceId } from '@aws-sdk/client-polly';
import { config } from '../config';
import { HttpError } from '../lib/http';

const polly = new PollyClient({});

/** Polly SynthesizeSpeech akzeptiert max. 3000 abrechenbare Zeichen. */
export const MAX_SPEECH_CHARS = 3000;

export function clampSpeechText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) throw new HttpError(400, 'text ist erforderlich');
  return trimmed.length > MAX_SPEECH_CHARS ? trimmed.slice(0, MAX_SPEECH_CHARS) : trimmed;
}

export class SpeechService {
  /** Deutsche Neural-Stimme (Standard: Vicki), MP3 für direkte Browser-Wiedergabe. */
  async synthesize(text: string): Promise<Uint8Array> {
    const res = await polly.send(
      new SynthesizeSpeechCommand({
        Engine: 'neural',
        VoiceId: config.pollyVoiceId as VoiceId,
        LanguageCode: 'de-DE',
        OutputFormat: 'mp3',
        Text: clampSpeechText(text),
      })
    );
    const audio = await res.AudioStream?.transformToByteArray();
    if (!audio?.length) throw new HttpError(502, 'Sprachsynthese lieferte kein Audio');
    return audio;
  }
}

export const speechService = new SpeechService();
