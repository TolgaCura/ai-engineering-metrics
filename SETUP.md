# Setup guide

## 1. Create the Next.js project

```bash
npx create-next-app@latest eng-metrics --typescript --tailwind --app
cd eng-metrics

# Install dependencies
npm install @anthropic-ai/sdk postgres
```

Replace the generated `src/` files with the ones from this repo.

---

## 2. Set up Postgres

Choose one:
- **[Neon](https://neon.tech)** — free tier, serverless Postgres, ideal for Next.js/Vercel
- **[Supabase](https://supabase.com)** — free tier, includes SQL editor
- **[Railway](https://railway.app)** — $5/mo hobby plan
- **Local** — `docker run -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16`

Copy your connection string, then:

```bash
cp .env.local.example .env.local
# Set DATABASE_URL in .env.local, then apply the schema:
npm run db:init
```

Update the seed rows at the bottom of `schema.sql` with your team's real GitHub usernames before running `db:init`.

---

## 3. Fill in all env vars

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Your Postgres provider dashboard |
| `GITHUB_TOKEN` | github.com/settings/tokens — fine-grained token, read PRs + contents |
| `GITHUB_WEBHOOK_SECRET` | Any random string: `openssl rand -hex 32` |
| `JIRA_DOMAIN` | Your Atlassian subdomain (e.g. `mycompany` for `mycompany.atlassian.net`) |
| `JIRA_EMAIL` | Your Atlassian account email |
| `JIRA_API_TOKEN` | id.atlassian.com → Security → API tokens |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |

---

## 4. Run locally

```bash
npm run dev
# Open http://localhost:3000
```

---

## 5. Deploy

**Vercel (recommended):**
```bash
npx vercel deploy
```
Add all env vars under: Vercel dashboard → Project → Settings → Environment Variables.

**Railway:**
```bash
railway up
```

---

## 6. Wire up the GitHub webhook

The `.github/workflows/pr-classifier.yml` file handles this — it fires on every PR merge and POSTs to your app.

Add these two secrets in your GitHub repo under **Settings → Secrets → Actions**:

| Secret | Value |
|---|---|
| `METRICS_WEBHOOK_URL` | Your deployed app URL, e.g. `https://eng-metrics.vercel.app` |
| `METRICS_WEBHOOK_SECRET` | Same value as `GITHUB_WEBHOOK_SECRET` in your `.env.local` |

---

## 7. Add sprints

Option A — sync from Jira by calling `getActiveSprints(boardId)` in `src/lib/jira.ts`.
Find your board ID at: `https://yourcompany.atlassian.net/rest/agile/1.0/board`

Option B — insert manually:
```sql
INSERT INTO sprints (name, starts_at, ends_at)
VALUES ('Sprint 24', '2026-04-14', '2026-04-28');
```

---

## 8. Test the webhook locally

Use [ngrok](https://ngrok.com) to expose localhost:
```bash
ngrok http 3000
# Set METRICS_WEBHOOK_URL to the ngrok https URL in your GitHub Action secret
```

Or fire a synthetic event directly:
```bash
curl -X POST http://localhost:3000/api/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: pull_request" \
  -d '{
    "action": "closed",
    "pull_request": {
      "id": 1, "number": 42,
      "title": "Fix ENG-123 price rounding bug",
      "body": "Fixes ENG-123",
      "user": { "login": "alex-k" },
      "base": { "repo": { "full_name": "yourorg/yourrepo" }, "ref": "main" },
      "created_at": "2026-04-14T10:00:00Z",
      "merged_at": "2026-04-14T12:00:00Z",
      "labels": [{ "name": "claude-code" }]
    }
  }'
```
