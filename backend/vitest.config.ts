import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    env: {
      TABLE_NAME: 'daemonai-test',
      AUDIO_BUCKET: 'daemonai-audio-test',
      USER_POOL_ID: 'eu-central-1_test',
      USER_POOL_CLIENT_ID: 'test-client',
      BEDROCK_MODEL_ID: 'test-model',
      STAGE: 'test',
    },
  },
});
