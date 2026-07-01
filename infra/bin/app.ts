#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { DataStack } from '../lib/data-stack';
import { AuthStack } from '../lib/auth-stack';
import { ApiStack } from '../lib/api-stack';
import { FrontendStack } from '../lib/frontend-stack';

const app = new cdk.App();

const stage = (app.node.tryGetContext('stage') as string | undefined) ?? 'dev';
if (stage !== 'dev' && stage !== 'prod') {
  throw new Error(`Unbekannte Stage "${stage}" – erlaubt sind "dev" und "prod" (cdk … -c stage=dev)`);
}

// Datenresidenz: alles in Frankfurt, Bedrock-Claude über EU-Inference-Profile
const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? 'eu-central-1',
};

const data = new DataStack(app, `DaemonAI-Data-${stage}`, { stage, env });
const auth = new AuthStack(app, `DaemonAI-Auth-${stage}`, { stage, env });

new ApiStack(app, `DaemonAI-Api-${stage}`, {
  stage,
  env,
  table: data.table,
  audioBucket: data.audioBucket,
  userPool: auth.userPool,
  userPoolClient: auth.userPoolClient,
});

new FrontendStack(app, `DaemonAI-Frontend-${stage}`, { stage, env });

app.synth();
