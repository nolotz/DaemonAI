import * as path from 'node:path';
import * as cdk from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface ApiStackProps extends cdk.StackProps {
  stage: 'dev' | 'prod';
  table: dynamodb.Table;
  audioBucket: s3.Bucket;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
}

const BACKEND = path.join(__dirname, '..', '..', 'backend', 'src');

/**
 * HTTP API (CRUD, JWT-Authorizer) + Lambda Function URL mit Response-Streaming
 * für den Chat. API Gateway kann keine gestreamten Antworten, die Function URL
 * schon – und beides skaliert auf null.
 */
export class ApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);
    const { stage, table, audioBucket, userPool, userPoolClient } = props;

    const modelId =
      (this.node.tryGetContext('bedrockModelId') as string | undefined) ??
      'eu.anthropic.claude-sonnet-4-5-20250929-v1:0';

    const commonEnv = {
      TABLE_NAME: table.tableName,
      AUDIO_BUCKET: audioBucket.bucketName,
      USER_POOL_ID: userPool.userPoolId,
      USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
      BEDROCK_MODEL_ID: modelId,
      STAGE: stage,
    };

    const makeFn = (name: string, entryFile: string, opts?: Partial<lambda.FunctionOptions>) =>
      new NodejsFunction(this, name, {
        entry: path.join(BACKEND, 'handlers', entryFile),
        handler: 'handler',
        runtime: lambda.Runtime.NODEJS_20_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 512,
        timeout: cdk.Duration.seconds(30),
        logRetention: logs.RetentionDays.ONE_MONTH,
        environment: commonEnv,
        bundling: { minify: true, sourceMap: true },
        ...opts,
      });

    const bedrockAccess = new iam.PolicyStatement({
      // Inference-Profile routen innerhalb der EU über mehrere Regionen,
      // daher kein einzelner Modell-ARN möglich
      actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
      resources: ['*'],
    });

    // ── CRUD-Lambdas hinter dem HTTP API ────────────────────────────────────
    const profileFn = makeFn('ProfileFn', 'profile.ts');
    const sessionsFn = makeFn('SessionsFn', 'sessions.ts', {
      timeout: cdk.Duration.seconds(60), // Abschluss-Zusammenfassung ruft Bedrock
    });
    const entriesFn = makeFn('EntriesFn', 'entries.ts');
    const insightsFn = makeFn('InsightsFn', 'insights.ts', {
      timeout: cdk.Duration.seconds(60),
    });
    const transcriptionFn = makeFn('TranscriptionFn', 'transcription.ts');
    const frameworksFn = makeFn('FrameworksFn', 'frameworks.ts');
    const speechFn = makeFn('SpeechFn', 'speech.ts');
    speechFn.addToRolePolicy(
      new iam.PolicyStatement({ actions: ['polly:SynthesizeSpeech'], resources: ['*'] })
    );

    for (const fn of [profileFn, sessionsFn, entriesFn, insightsFn, transcriptionFn]) {
      table.grantReadWriteData(fn);
    }
    sessionsFn.addToRolePolicy(bedrockAccess);
    insightsFn.addToRolePolicy(bedrockAccess);
    audioBucket.grantReadWrite(transcriptionFn);
    transcriptionFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['transcribe:StartTranscriptionJob', 'transcribe:GetTranscriptionJob'],
        resources: ['*'],
      })
    );

    const httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      apiName: `daemonai-${stage}`,
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PUT,
          apigwv2.CorsHttpMethod.DELETE,
        ],
        allowHeaders: ['authorization', 'content-type'],
        maxAge: cdk.Duration.hours(1),
      },
    });

    const authorizer = new HttpJwtAuthorizer('JwtAuth', userPool.userPoolProviderUrl, {
      jwtAudience: [userPoolClient.userPoolClientId],
    });

    const { GET, POST, PUT } = apigwv2.HttpMethod;
    const routes: Array<[string, apigwv2.HttpMethod[], NodejsFunction]> = [
      ['/me', [GET, PUT], profileFn],
      ['/frameworks', [GET], frameworksFn],
      ['/sessions', [GET, POST], sessionsFn],
      ['/sessions/{id}', [GET], sessionsFn],
      ['/sessions/{id}/complete', [POST], sessionsFn],
      ['/entries', [GET], entriesFn],
      ['/entries/{date}/{id}', [GET], entriesFn],
      ['/insights', [GET], insightsFn],
      ['/speech', [POST], speechFn],
      ['/transcriptions', [POST], transcriptionFn],
      ['/transcriptions/{id}/start', [POST], transcriptionFn],
      ['/transcriptions/{id}', [GET], transcriptionFn],
    ];
    for (const [routePath, methods, fn] of routes) {
      httpApi.addRoutes({
        path: routePath,
        methods,
        integration: new HttpLambdaIntegration(`${fn.node.id}-${routePath}`, fn),
        authorizer,
      });
    }

    // ── Chat-Lambda mit Streaming-Function-URL ──────────────────────────────
    const chatFn = makeFn('ChatFn', 'chat.ts', {
      memorySize: 1024,
      timeout: cdk.Duration.minutes(5),
    });
    table.grantReadWriteData(chatFn);
    chatFn.addToRolePolicy(bedrockAccess);

    const chatUrl = chatFn.addFunctionUrl({
      // Auth macht der Handler selbst per aws-jwt-verify –
      // Function URLs kennen keinen Cognito-Authorizer
      authType: lambda.FunctionUrlAuthType.NONE,
      invokeMode: lambda.InvokeMode.RESPONSE_STREAM,
      cors: {
        allowedOrigins: ['*'],
        allowedMethods: [lambda.HttpMethod.POST],
        allowedHeaders: ['authorization', 'content-type'],
        maxAge: cdk.Duration.hours(1),
      },
    });

    new cdk.CfnOutput(this, 'ApiUrl', { value: httpApi.apiEndpoint });
    new cdk.CfnOutput(this, 'ChatUrl', { value: chatUrl.url });
    new cdk.CfnOutput(this, 'BedrockModelId', { value: modelId });
  }
}
