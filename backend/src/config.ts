function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Fehlende Umgebungsvariable: ${name}`);
  }
  return value;
}

/** Lazy, damit Tests Umgebungsvariablen vor dem ersten Zugriff setzen können. */
export const config = {
  get tableName() {
    return env('TABLE_NAME');
  },
  get audioBucket() {
    return env('AUDIO_BUCKET');
  },
  get userPoolId() {
    return env('USER_POOL_ID');
  },
  get userPoolClientId() {
    return env('USER_POOL_CLIENT_ID');
  },
  get bedrockModelId() {
    return env('BEDROCK_MODEL_ID', 'eu.anthropic.claude-sonnet-4-5-20250929-v1:0');
  },
  get pollyVoiceId() {
    return env('POLLY_VOICE_ID', 'Vicki');
  },
  get stage() {
    return env('STAGE', 'dev');
  },
  get region() {
    return env('AWS_REGION', 'eu-central-1');
  },
};
