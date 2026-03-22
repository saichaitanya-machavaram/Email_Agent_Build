# Azure Migration Approach — Email Agent

## Overview

This document outlines how to rebuild or migrate the Email Agent application
entirely within the Microsoft Azure ecosystem. The architecture maps closely
to the current stack with Azure-native equivalents for each component.

---

## Architecture Mapping

| Current Stack | Azure Equivalent | Notes |
|---|---|---|
| Next.js on Vercel | Azure Static Web Apps | Native Next.js support with API routes |
| Supabase Auth (Google OAuth) | Azure AD B2C | Enterprise-grade identity, supports Google as external IdP |
| Supabase Postgres + pgvector | Azure Database for PostgreSQL Flexible Server | pgvector extension available |
| Supabase Storage (if used) | Azure Blob Storage | |
| Railway (background jobs) | Azure Container Apps / Azure Functions | |
| Vercel CI/CD | Azure DevOps Pipelines or GitHub Actions → Azure | |
| OpenAI API | Azure OpenAI Service | Same models, deployed within Azure region |

---

## Component-by-Component Approach

---

### 1. Frontend — Azure Static Web Apps

**Service:** Azure Static Web Apps (SWA)

Azure Static Web Apps has first-class Next.js support and can run API routes
as Azure Functions automatically. This means the current Next.js app can be
deployed with minimal changes.

**Steps:**
- Create a Static Web App in Azure Portal
- Connect to the GitHub repository (Email_Agent_Build)
- Azure automatically detects Next.js and configures the build pipeline
- API routes under `src/app/api/` become Azure Functions automatically
- Set all environment variables in SWA → Configuration → Application settings

**CI/CD:**
- Every push to `master` triggers an automatic build and deploy via GitHub Actions
- Azure injects a workflow YAML file into your repo automatically on setup
- Zero manual deployment steps after initial setup

**Cost:** Free tier available (100 GB bandwidth/month, custom domains included)

---

### 2. Authentication — Azure AD B2C

**Service:** Azure Active Directory B2C

Azure AD B2C is the enterprise identity platform that supports external
identity providers including Google. It replaces Supabase Auth entirely.

**Steps:**
- Create an Azure AD B2C tenant in the Azure Portal
- Register your app as an Application in B2C
- Add Google as an Identity Provider:
  - Go to B2C → Identity Providers → Google
  - Paste the same Google Client ID and Secret from Google Cloud Console
  - No changes needed in Google Cloud — same OAuth app works
- Configure User Flows: Sign up / Sign in flow
- In Next.js, replace `@supabase/ssr` with `next-auth` using the `azure-ad-b2c` provider
  or use MSAL (Microsoft Authentication Library) directly

**Gmail OAuth Token Handling:**
This is the trickiest part. Currently Supabase Auth captures the Google
provider_token (Gmail OAuth token) after login. With Azure AD B2C:
- Configure B2C to pass through the Google access token as a claim
- Or implement a separate Gmail OAuth flow independently of authentication
  using the `googleapis` library with your own token storage in Azure Key Vault

**Cost:** 50,000 monthly active users free, then $0.0016 per MAU

---

### 3. Database — Azure Database for PostgreSQL Flexible Server

**Service:** Azure Database for PostgreSQL Flexible Server

This is a fully managed Postgres service that supports the pgvector extension,
which is required for the RAG (vector similarity search) functionality.

**Steps:**
- Create a PostgreSQL Flexible Server instance in Azure Portal
  - Recommended: Burstable tier (B1ms) for low-traffic apps — ~$13/month
  - Region: Choose same region as your Static Web App (e.g. East US)
- Enable pgvector extension:
  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;
  ```
- Run the existing schema from `supabase/schema.sql` — it works unchanged
  since it is standard PostgreSQL
- Run `supabase/add_reply_embeddings.sql` for the reply embeddings table
- Update connection strings in environment variables

**Row-Level Security:**
Supabase RLS is a Supabase-specific feature. In Azure PostgreSQL:
- Either implement RLS manually using PostgreSQL native RLS policies
- Or handle authorization in the application layer (API routes check user
  identity before every query)
- Recommendation: application-layer authorization is simpler and sufficient
  for a single-owner app

**ORM / Query Client:**
Replace `@supabase/supabase-js` with:
- `pg` (node-postgres) for raw queries
- Or `prisma` with the PostgreSQL adapter — Prisma also supports pgvector
  via the `@prisma/client` extension

**Connection Pooling:**
- Enable PgBouncer in Azure PostgreSQL Flexible Server settings
- This is important for serverless/Azure Functions environments

**Cost:** Burstable B1ms ~$13/month. Can stop the server when not in use
to reduce costs (pay per hour when running).

---

### 4. AI — Azure OpenAI Service

**Service:** Azure OpenAI Service

Azure OpenAI gives you access to the same GPT-4o and embedding models
(text-embedding-3-small) but deployed within Azure's infrastructure, which
is important for data residency and enterprise compliance.

**Steps:**
- Request access to Azure OpenAI (requires approval, typically 1-3 days)
- Create an Azure OpenAI resource in the Azure Portal
- Deploy two models:
  - `gpt-4o` for reply generation
  - `text-embedding-3-small` for embeddings
- Update the OpenAI client in the code:

```typescript
// Current
import OpenAI from 'openai'
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Azure OpenAI
import OpenAI from 'openai'
const openai = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  baseURL: `https://${process.env.AZURE_OPENAI_RESOURCE}.openai.azure.com/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}`,
  defaultQuery: { 'api-version': '2024-02-01' },
  defaultHeaders: { 'api-key': process.env.AZURE_OPENAI_API_KEY },
})
```

**Cost:** Pay per token — same pricing structure as OpenAI directly.
No cost when not in use.

---

### 5. Background Jobs — Azure Functions or Container Apps

**Service:** Azure Functions (consumption plan)

For any background processing (e.g. periodic Gmail sync, batch embedding):
- Azure Functions with a Timer Trigger replaces any Railway worker
- Consumption plan = pay per execution, free tier includes 1M executions/month
- Can reuse the same TypeScript code from the existing API routes

**Example: Scheduled Gmail sync every 30 minutes**
```typescript
// Azure Function with Timer Trigger
import { app } from '@azure/functions'
app.timer('gmailSync', {
  schedule: '0 */30 * * * *',
  handler: async () => {
    // same logic as /api/gmail/inbox route
  }
})
```

---

### 6. Secrets Management — Azure Key Vault

**Service:** Azure Key Vault

Replace `.env.local` and Vercel environment variables with Azure Key Vault
for production-grade secrets management.

- Store: OpenAI API key, Google Client Secret, DB connection string
- Reference secrets in Static Web Apps via managed identity (no hardcoded keys)
- Automatic rotation support for database credentials

---

### 7. CI/CD — GitHub Actions → Azure

When you connect your GitHub repo to Azure Static Web Apps, Azure automatically
creates a GitHub Actions workflow file (`.github/workflows/azure-static-web-apps.yml`).

The pipeline:
1. On push to `master` → trigger build
2. Build Next.js app
3. Deploy to Azure Static Web Apps
4. API routes deployed as Azure Functions automatically

For database migrations, add a step to run SQL migration files against
Azure PostgreSQL using `psql` or Prisma Migrate.

---

## Migration Effort Estimate

| Task | Effort |
|---|---|
| Deploy Next.js to Azure Static Web Apps | 2-4 hours |
| Set up Azure PostgreSQL + migrate schema | 4-6 hours |
| Switch OpenAI to Azure OpenAI | 1-2 hours |
| Set up Azure AD B2C with Google IdP | 1-2 days |
| Handle Gmail token passthrough via B2C | 1-2 days |
| Replace Supabase client with pg/prisma | 4-8 hours |
| Testing and debugging | 1-2 days |
| **Total** | **~5-8 days** |

The authentication migration (Azure AD B2C + Gmail token handling) is the
hardest part. Everything else is largely configuration with minor code changes.

---

## What Stays the Same

- All Next.js application code (pages, components, logic)
- Gmail API integration (same Google Cloud project, same credentials)
- OpenAI model calls (just different base URL)
- RAG pipeline logic (pgvector SQL is standard PostgreSQL)
- Knowledge base seeding script
- All environment variable names (just different values)

---

## Recommended Approach

If staying on Azure is a hard requirement:
1. Start with Azure Static Web Apps for the frontend — lowest friction
2. Use Azure OpenAI from day one — straightforward swap
3. Keep Supabase temporarily for auth and database during transition
4. Migrate to Azure PostgreSQL once the app is stable on Azure SWA
5. Migrate auth to Azure AD B2C last — it is the most complex piece

This phased approach keeps the app running throughout the migration
with no downtime windows.
