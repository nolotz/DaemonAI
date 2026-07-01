import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface DataStackProps extends cdk.StackProps {
  stage: 'dev' | 'prod';
}

/**
 * DynamoDB-Single-Table + S3-Bucket für Audio-Uploads (Transcribe).
 * On-Demand-Billing und Verschlüsselung at rest auf allem.
 */
export class DataStack extends cdk.Stack {
  readonly table: dynamodb.Table;
  readonly audioBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);
    const isProd = props.stage === 'prod';

    this.table = new dynamodb.Table(this, 'Table', {
      tableName: `daemonai-${props.stage}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: isProd },
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    this.audioBucket = new s3.Bucket(this, 'AudioBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      // Sprachnotizen sind nach der Transkription wertlos – automatisch aufräumen
      lifecycleRules: [{ expiration: cdk.Duration.days(30) }],
      cors: [
        {
          // Presigned-PUT direkt aus dem Browser
          allowedMethods: [s3.HttpMethods.PUT],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3600,
        },
      ],
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProd,
    });

    new cdk.CfnOutput(this, 'TableName', { value: this.table.tableName });
    new cdk.CfnOutput(this, 'AudioBucketName', { value: this.audioBucket.bucketName });
  }
}
