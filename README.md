# DaemonAI

An open-source AI journal with an interview mode. Instead of staring at a blank page, an AI guides you through your day in a conversation — type or speak, anytime during the day or in the evening. At the end of each session, the AI turns the conversation into a well-written journal entry. Over time, the app surfaces mood trends and recurring topics.

**German-first** (UI and AI questions), with an i18n structure for additional languages. License: MIT.

## Features

- **Interview sessions** — adaptive follow-up questions that build on your answers, streamed in real time
- **Three swappable question frameworks** — Socratic method, Motivational Interviewing (OARS), daily review; a new template is just a JSON file in `backend/src/frameworks/`
- **Text and voice input** — Amazon Transcribe, with a fallback to the browser's Web Speech API
- **Voice mode (real spoken conversation)** — AI questions are read aloud via Amazon Polly (German neural voice); when playback ends, recording starts automatically and your transcribed answer is sent right away
- **Automatic entries** — the AI summarizes the conversation, including mood (1–10) and topics
- **History** — all entries by date, searchable
- **Insights** — mood trend and topic frequency per week/month, with an AI-written review
- **Calm, responsive design** with dark mode, mobile-first

## Architecture

```
Browser (React/Vite, S3 + CloudFront)
   │
   ├─► API Gateway HTTP API ──► Lambda (sessions, entries, insights, transcribe, profile)
   │        └─ Cognito JWT authorizer
   ├─► Lambda Function URL (response streaming) ──► chat SSE ─► Bedrock (Claude)
   │        └─ JWT verified in the handler (aws-jwt-verify)
   │
   ├─► S3 (presigned PUT for audio) ──► Amazon Transcribe
   └─► POST /speech ──► Amazon Polly (text-to-speech, de-DE neural)
                          DynamoDB (single table, on-demand)
```

Everything is serverless and scales to zero — idle cost is effectively nil. Region: `eu-central-1` (data residency). The Bedrock call is encapsulated behind an `LlmService` interface (`backend/src/services/llm/`); switching to Ollama or another provider means implementing that one interface.

### DynamoDB key design (single table `daemonai-{stage}`)

| Entity    | PK                  | SK                          |
|-----------|---------------------|-----------------------------|
| Profile   | `USER#<sub>`        | `PROFILE`                   |
| Session   | `USER#<sub>`        | `SESSION#<ulid>`            |
| Message   | `SESSION#<id>`      | `MSG#<seq>`                 |
| Entry     | `USER#<sub>`        | `ENTRY#<YYYY-MM-DD>#<ulid>` |
| Insight   | `USER#<sub>`        | `INSIGHT#<WEEK\|MONTH>#…`   |

Every access starts with the `sub` from the verified JWT — user data is separated structurally. Details in `backend/src/db/keys.ts`.

## Repository layout

```
frontend/   React + TypeScript + Vite + Tailwind (conversation, history, insights)
backend/    Node + TypeScript: Lambda handlers, services, frameworks, tests
infra/      AWS CDK (TypeScript): Data, Auth, Api, Frontend stacks × dev/prod
shared/     Shared API types
docs/       AWS permissions
```

## Setup

Prerequisites: Node ≥ 20, an AWS account with [Bedrock Claude model access enabled](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html) in `eu-central-1`, and AWS credentials in your terminal (profile/SSO).

```bash
git clone <repo-url> && cd DaemonAI
npm install
```

## Deploy (one command)

```bash
# once per account/region:
npx cdk bootstrap --profile <profile>

npm run deploy:dev     # builds the frontend and rolls out all 4 stacks
npm run deploy:prod    # production stage (with confirmation, retain policies, PITR)
```

After the first deploy, the CloudFormation outputs contain `ApiUrl`, `ChatUrl`, `UserPoolId`, `UserPoolClientId`, and `SiteUrl`. Put them into `frontend/.env.local` (template: `.env.example`) and deploy again — or use them directly for local development.

The Bedrock model is configurable: `cdk deploy -c stage=dev -c bedrockModelId=eu.anthropic.claude-…`.

The minimal IAM permissions for the deploy user are documented in [`docs/aws-permissions.md`](docs/aws-permissions.md).

## Local development

The local dev server emulates both API Gateway **and** the streaming Function URL. Auth, DynamoDB, Bedrock, and Transcribe run against the real dev resources (so: `deploy:dev` first, then develop locally).

```bash
# create backend/.env (values from the stack outputs, see .env.example)
npm run dev:backend    # handlers on http://localhost:3001, chat stream on /chat

# frontend/.env.local: only VITE_USER_POOL_ID + VITE_USER_POOL_CLIENT_ID are needed;
# without further config the API URLs automatically point to localhost:3001
npm run dev:frontend   # Vite on http://localhost:5173
```

## Tests & checks

```bash
npm test                                # backend tests (vitest)
npm run typecheck                       # tsc across all workspaces
npm run build                           # incl. frontend production build
npm run synth --workspace infra         # validate CDK templates without an AWS account
```

## Privacy & security

- Encryption in transit (TLS everywhere, `enforceSSL` on the buckets) and at rest (DynamoDB SSE, S3 SSE)
- No third-party data sharing: the AI runs on Amazon Bedrock in `eu-central-1`; [Bedrock does not use inputs for model training](https://docs.aws.amazon.com/bedrock/latest/userguide/data-protection.html)
- Cognito protects every route; the streaming URL verifies the JWT itself (`aws-jwt-verify`)
- No secrets in code — access runs through IAM roles; AWS Secrets Manager is the designated place for external credentials
- Audio recordings are deleted automatically after 30 days (S3 lifecycle)
- Separate, independently deployable `dev` and `prod` stages

## License

[MIT](LICENSE)
