# Engineering Metrics Dashboard — Claude Code Context

## What this project is
A multi-tenant SaaS application that tracks Claude Code usage, PR velocity, and AI regression rates across engineering teams. Teams sign up, connect their GitHub account via OAuth, and optionally connect Jira. The app automatically classifies merged PRs as regressions (AI-introduced or manual) using the Anthropic API. Each team is an isolated **workspace** (backed by a Clerk organization).

## Stack
- **Framework**: Next.js 16.2.4 (App Router)
- **Language**: JavaScript (no TypeScript)
- **Package manager**: npm
- **Database**: Postgres (via the `postgres` npm package — NOT pg, NOT prisma, NOT drizzle)
- **Auth**: Clerk (`@clerk/nextjs`) — social login, organizations, invitations
- **AI**: Anthropic API (`@anthropic-ai/sdk`) using `claude-haiku-4-5-20251001`
- **Styling**: Tailwind CSS v4

## Project structure
```
src/
├── proxy.js                          # Clerk auth middleware (Next.js 16 uses "proxy" not "middleware")
├── schema.sql                        # Full Postgres schema (applied via npm run db:init)
│
├── app/
│   ├── layout.jsx                    # Root layout — wraps app in <ClerkProvider>
│   ├── page.jsx                      # Server component — auth + onboarding guard, renders dashboard
│   ├── dashboard-client.jsx          # Dashboard UI (client component — leaderboard, metrics, charts)
│   ├── init-db.js                    # Run with npm run db:init — applies schema.sql
│   │
│   ├── onboarding/page.jsx           # 4-step onboarding wizard (workspace → GitHub → Jira → repos)
│   ├── settings/page.jsx             # Server component — fetches auth + members via Clerk backend SDK
│   ├── settings/settings-client.jsx  # Client component — all settings UI (receives data as props)
│   ├── sign-in/[[...sign-in]]/       # Clerk sign-in page
│   └── sign-up/[[...sign-up]]/       # Clerk sign-up page
│   │
│   └── api/
│       ├── auth/github/route.js          # GET — initiates GitHub OAuth redirect
│       ├── auth/github/callback/route.js # GET — handles GitHub OAuth callback, stores token
│       ├── metrics/route.js              # GET /api/metrics — dashboard data (auth + workspace scoped)
│       ├── onboarding/jira/route.js      # POST — test and save Jira credentials
│       ├── onboarding/repos/route.js     # GET repos list; POST save tracked repos + complete onboarding
│       ├── settings/invite/route.js      # POST — send Clerk org invitation (admin only)
│       ├── settings/workspace/route.js   # GET — workspace connection status (for settings UI)
│       ├── webhook/route.js              # POST /api/webhook — receives GitHub webhook on PR merge
│       └── workspaces/route.js           # POST — create workspace row after Clerk org creation
│
└── lib/
    ├── db.js                         # Postgres client + all query helpers (workspace-scoped)
    ├── classifier.js                 # Claude regression classifier
    ├── crypto.js                     # AES-256-GCM encrypt/decrypt for DB secrets
    ├── github.js                     # GitHub REST API helpers (token passed as param)
    ├── jira.js                       # Jira Cloud REST API v3 helpers (credentials passed as param)
    └── workspace.js                  # Workspace DB helpers + credential storage
```

## Multi-tenancy model
- **Workspace = Clerk Organization**. The Clerk `orgId` is used as the primary key in the `workspaces` table and as a foreign key (`workspace_id`) in every other table.
- All DB query helpers in `src/lib/db.js` take `workspaceId` as their first parameter.
- All API routes call `auth()` from Clerk and extract `orgId` before hitting the database.
- GitHub and Jira credentials are stored **per workspace** in the `workspaces` table, AES-256-GCM encrypted. The shared Anthropic API key stays in the environment.

## Database schema (Postgres)
Schema lives at `src/schema.sql`. Tables:
- `workspaces` — one per team (Clerk org ID as PK); stores encrypted GitHub token, Jira creds, webhook secret
- `tracked_repos` — repos a workspace has selected to track; used for webhook routing
- `engineers` — one row per team member, keyed on `(workspace_id, github_login)`
- `pull_requests` — one row per merged PR; includes `is_ai_assisted`, `regression_label`, `cycle_time_hours`
- `sprints` — sprint date ranges, scoped to workspace
- `webhook_events` — raw log of every inbound GitHub webhook (for debugging/replay)

`regression_label` values: `'ai_regression' | 'manual_regression' | 'clean' | 'pending' | 'unclassified'`

## How the regression classifier works
1. A PR is merged to main; GitHub fires a webhook to `POST /api/webhook`
2. The webhook handler looks up the workspace by matching the repo against `tracked_repos`
3. It verifies the per-workspace HMAC secret, then fetches the diff, detects Claude Code usage, fetches the linked Jira ticket (if Jira is configured), and finds prior AI-assisted PRs on the same files
4. All context is passed to `classifyPR()` in `src/lib/classifier.js` which calls `claude-haiku-4-5-20251001`
5. Claude returns `{ label, reasoning, confidence }` as JSON
6. The label is written back to `pull_requests`

## Claude Code detection logic (`src/lib/github.js` — `detectAIAssisted`)
Checks in order:
1. PR has a label containing "claude"
2. PR body contains "Co-authored-by: Claude" or "claude code"
3. Any commit message contains "Co-authored-by: Claude", "claude code", or "🤖"

## Credential encryption (`src/lib/crypto.js`)
Encrypted fields: `workspaces.github_access_token`, `workspaces.jira_api_token`.
Algorithm: AES-256-GCM. Key source: `ENCRYPTION_KEY` env var (64-char hex string). Generate with: `openssl rand -hex 32`.
`workspace.js` calls `encrypt()` before writing and `decrypt()` after reading these fields.

## Onboarding flow
New users are redirected to `/onboarding` after sign-up. Four steps:
1. **Workspace name** — creates a Clerk org + inserts a `workspaces` row via `POST /api/workspaces`
2. **Connect GitHub** — redirects to GitHub OAuth; callback at `/api/auth/github/callback` stores the token
3. **Connect Jira** — optional; tests credentials before saving; can be skipped
4. **Select repos** — lists GitHub repos; selected repos are saved to `tracked_repos`; shows the webhook URL to configure in GitHub

`page.jsx` (server component) redirects to `/onboarding` if `onboarding_complete = false`.

## Invitation flow
From `/settings`, admins can invite team members by email with Admin or Member role. This calls Clerk's `createOrganizationInvitation` API via `POST /api/settings/invite`. Invitees sign in with social login and land on the dashboard (onboarding is skipped for joined members).

## Dashboard views
`dashboard-client.jsx` supports three views toggled in the UI:
- **Sprint** — filtered by sprint date range (sprint selector dropdown)
- **Month** — filtered by calendar month
- **Year** — filtered by full year

All views use `GET /api/metrics?view=sprint|month|year`.

## Environment variables required
```
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding

# GitHub OAuth App (one SaaS-level app — all workspaces share it)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Encryption key for DB-stored secrets
ENCRYPTION_KEY=          # 64-char hex string; generate: openssl rand -hex 32

# Shared — not per-workspace
DATABASE_URL=
ANTHROPIC_API_KEY=
```

Note: `GITHUB_TOKEN`, `GITHUB_WEBHOOK_SECRET`, and `JIRA_*` are no longer environment variables — they are stored per workspace in the database.

## Key decisions made in this project
- Using the `postgres` npm package (not `pg`) — tagged template literals: `` sql`SELECT...` ``
- No TypeScript — plain JavaScript throughout
- No ORM — raw SQL queries in `src/lib/db.js`
- Auth middleware is `src/proxy.js` — Next.js 16.2.4 with Turbopack uses the filename `proxy` instead of `middleware`
- `next.config.mjs` uses ESM (`export default`) — do NOT change to CommonJS
- `src/app/init-db.js` reads `src/schema.sql` (one level up: `join(__dirname, '..', 'schema.sql')`)
- `sql` in `db.js` is a Proxy over the postgres client — this defers initialization so `DATABASE_URL` is not required at module load time (avoids Next.js build-time crashes)
- Webhook returns HTTP 200 even on classifier errors — the raw event is always logged to `webhook_events` first
- Webhook routing: a single `POST /api/webhook` endpoint looks up the workspace by matching `payload.repository.full_name` against `tracked_repos`; no per-workspace URL needed
- **Avoid all Clerk hooks that touch org/membership state** (`useOrganization`, `useOrganizationList`) — they trigger Clerk's internal tanstack-query mock-client path and throw `query.isFetched is not a function` in v7. The established pattern:
  - To call `createOrganization`: use `useClerk()` and call `clerk.createOrganization()`
  - To read org/member data in a page: make the page a server component, call `auth()` + `clerkClient()` server-side, pass data as plain props to a client sub-component
  - Settings page follows this pattern: `settings/page.jsx` (server) → `settings/settings-client.jsx` (client, props only)

## npm scripts
```
npm run dev       # Start dev server
npm run build     # Production build
npm run start     # Start production server
npm run db:init   # Apply schema.sql to Postgres
```
