# Required AWS permissions

## Runtime (automatic, nothing to do)

The Lambda roles are created by the CDK with least-privilege grants:

| Function | Permissions |
|---|---|
| Profile/Sessions/Entries/Insights/Chat | `dynamodb:GetItem/PutItem/UpdateItem/Query/TransactWrite*` on the single table |
| Sessions/Insights/Chat | `bedrock:InvokeModel`, `bedrock:InvokeModelWithResponseStream` (resource `*`, because EU inference profiles route across several regions) |
| Transcription | `s3:GetObject/PutObject` on the audio bucket, `transcribe:StartTranscriptionJob`, `transcribe:GetTranscriptionJob` |

## Deploy user / CI role

Recommended: have an admin run `cdk bootstrap` once; after that the deploy
user only needs to assume the CDK bootstrap roles and read the bootstrap
version parameter:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AssumeCdkRoles",
      "Effect": "Allow",
      "Action": "sts:AssumeRole",
      "Resource": "arn:aws:iam::*:role/cdk-*"
    },
    {
      "Sid": "ReadCdkBootstrapVersion",
      "Effect": "Allow",
      "Action": "ssm:GetParameter",
      "Resource": "arn:aws:ssm:*:*:parameter/cdk-bootstrap/*"
    }
  ]
}
```

The actual resources (DynamoDB, Cognito, S3, CloudFront, API Gateway, Lambda,
the functions' IAM roles) are created by CloudFormation through the CDK deploy
role — the deploy user needs no direct permissions for them.

## One-time / manual

- **Bedrock model access**: in the AWS console (region `eu-central-1`), enable
  access to the desired Claude model under *Bedrock → Model access*. Without
  this step, chat and summarization fail.
- **`cdk bootstrap`** (once per account/region): requires near-admin
  permissions (creates an S3 bucket, an ECR repo, and the `cdk-*` IAM roles).

## What is deliberately NOT needed

- No access keys in code or `.env` files — everything runs through IAM roles
  or the local AWS profile.
- No `iam:*`, `s3:*`, etc. for the deploy user once bootstrapping is done.
