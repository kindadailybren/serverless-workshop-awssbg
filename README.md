# Module V: Infrastructure as Code — Serverless Profile Page

A complete serverless profile platform built with **AWS CDK**, demonstrating the full IaC software lifecycle.  
Users authenticate securely through **Amazon Cognito**, each managing an isolated personal profile in **DynamoDB** with direct presigned S3 avatar uploads and dual dedicated **CloudFront** distributions.

---

## Architecture

```
                                  ┌─────────────────────────────┐
                                  │   Amazon Cognito User Pool  │
                                  └──────────────┬──────────────┘
                                                 │ (Post-Confirmation trigger)
                                                 ▼
┌─────────────────────────┐       ┌─────────────────────────────┐
│  Browser / React SPA    │──────▶│   DynamoDB ProfileTable     │
│  (Custom Minimal UI)    │       │   (PK: userId = sub)        │
└───────────┬─────────────┘       └──────────────▲──────────────┘
            │                                    │
            │ Bearer Access Token                │
            ▼                                    │
┌─────────────────────────┐       ┌──────────────┴──────────────┐
│  API Gateway REST API   │──────▶│  Lambdas (User Isolated):   │
│  (Cognito Authorizer)   │       │  - getProfile               │
└─────────────────────────┘       │  - updateProfile            │
                                  │  - getUploadUrl             │
                                  └──────────────┬──────────────┘
                                                 │
                                                 ▼ Presigned PUT URL
┌─────────────────────────────────┐       ┌─────────────────────────────┐
│ CloudFront #1 (Frontend SPA)    │       │ CloudFront #2 (Assets CDN)  │
│ └──▶ S3: FrontendBucket         │       │ └──▶ S3: AssetsBucket (OAC) │
└─────────────────────────────────┘       └─────────────────────────────┘
```

### CDK Stacks

| Stack | What it creates | Deploy order |
|-------|----------------|--------------|
| **StatefulStack** | DynamoDB table, S3 assets bucket, Cognito User Pool, Client, and Post-Confirmation trigger | 1st |
| **StatelessStack** | 3 Lambda functions, API Gateway REST API with Cognito Authorizer | 2nd |
| **GlobalStack** | React frontend on S3, dedicated Frontend CloudFront distribution, dedicated Assets CloudFront distribution | 3rd |

Stacks are deployed in order because each one depends on outputs from the previous stack.

---

## Prerequisites

Install the following tools before you begin:

| Tool | Minimum version | How to install |
|------|----------------|----------------|
| Node.js | 18+ | https://nodejs.org |
| AWS CLI | v2 | https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html |
| AWS CDK CLI | latest | `npm install -g aws-cdk` |
| Git | any | https://git-scm.com |

### Configure AWS credentials

```bash
aws configure
```

Verify your credentials:

```bash
aws sts get-caller-identity
cdk --version
```

---

## Setup

```bash
# 1. Install CDK dependencies
npm install

# 2. Install frontend dependencies
cd frontend && npm install && cd ..
```

---

## Deployment Lifecycle

Follow these steps in order.

---

### Step 1 — Bootstrap your AWS account (once per account/region)

```bash
cdk bootstrap
```

---

### Step 2 — Synthesize (verify your templates locally)

```bash
npm run build && cdk synth
```

---

### Step 3 — Deploy StatefulStack (database, storage, auth)

```bash
cdk deploy StatefulStack
```

This creates:
- **DynamoDB table** (`ProfileTable`) for user profile records (partitioned by Cognito `userId`)
- **S3 bucket** for profile picture uploads (`AssetsBucket`)
- **Cognito User Pool & Client** with email verification
- **Post-Confirmation Lambda trigger** to initialize profile records automatically upon verification

Copy the outputs:
- `StatefulStack.UserPoolId`
- `StatefulStack.UserPoolClientId`

---

### Step 4 — Deploy StatelessStack (backend API & security)

```bash
cdk deploy StatelessStack
```

This creates:
- **3 Lambda functions** (`getProfile`, `updateProfile`, `getUploadUrl`) that extract `userId` from verified Cognito claims
- **API Gateway REST API** protected by a **Cognito User Pools Authorizer**

Copy the output:
- `StatelessStack.ApiUrl`

---

### Step 5 — Deploy GlobalStack (CDNs & S3 hosting)

```bash
cdk deploy GlobalStack
```

This creates:
- **Frontend S3 Bucket** and **Frontend CloudFront Distribution** (CloudFront #1)
- **Dedicated Assets CloudFront Distribution** (CloudFront #2) serving profile pictures via Origin Access Control (OAC)

Copy the outputs:
- `GlobalStack.FrontendUrl`
- `GlobalStack.AssetsUrl`

---

### Step 6 — Configure the Frontend `.env`

Create `frontend/.env` using the outputs from the steps above:

```bash
cat > frontend/.env << 'EOF'
VITE_API_URL=<StatelessStack.ApiUrl without trailing slash>
VITE_ASSETS_CLOUDFRONT_URL=<GlobalStack.AssetsUrl>
VITE_COGNITO_USER_POOL_ID=<StatefulStack.UserPoolId>
VITE_COGNITO_CLIENT_ID=<StatefulStack.UserPoolClientId>
VITE_AWS_REGION=us-east-1
EOF
```

> **Note:** Ensure `VITE_API_URL` and `VITE_ASSETS_CLOUDFRONT_URL` have no trailing slashes.

---

### Step 7 — Build & Publish Frontend to CloudFront

```bash
# Build React application
cd frontend && npm run build && cd ..

# Deploy build to GlobalStack S3 bucket and invalidate CDN
cdk deploy GlobalStack
```

Open `GlobalStack.FrontendUrl` in your browser.

---

## Features & Usage

1. **Authentication**:
   - Create an account with email and password (minimum 8 characters).
   - Check your email inbox for the 6-digit verification code.
   - Enter code to confirm and automatically sign in.
2. **Profile Isolation**:
   - Each profile is strictly tied to the user's Cognito `sub` identifier. No user can view or overwrite another user's profile.
3. **In-Place Minimal Editing**:
   - Profile card displays cleanly in view mode.
   - Click the small **Pen icon** in the top right to switch into edit mode with animated inputs.
   - Edit your name and bio, then click **Save Changes** or **Cancel**.
4. **Avatar Upload**:
   - Hover over the avatar and click the **Camera badge** button.
   - Select any image; it uploads directly to S3 via presigned URL and updates immediately through the dedicated Assets CloudFront CDN.

---

## Cleanup

When finished, delete all resources to prevent further AWS charges:

```bash
cdk destroy --all
```
