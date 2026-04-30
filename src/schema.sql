-- Enable pgcrypto for gen_random_bytes
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Workspaces (one per team / Clerk org) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS workspaces (
  id                   TEXT PRIMARY KEY,  -- Clerk org ID, e.g. "org_abc123"
  name                 TEXT NOT NULL,
  github_access_token  TEXT,              -- AES-256-GCM encrypted
  jira_domain          TEXT,
  jira_email           TEXT,
  jira_api_token       TEXT,              -- AES-256-GCM encrypted
  webhook_secret       TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  onboarding_complete  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tracked repos (webhook routing + onboarding selection) ────────────────────
CREATE TABLE IF NOT EXISTS tracked_repos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  repo_full_name TEXT NOT NULL,           -- e.g. "acme/backend"
  UNIQUE (workspace_id, repo_full_name)
);

CREATE INDEX IF NOT EXISTS tracked_repos_repo_idx ON tracked_repos (repo_full_name);

-- ── Engineers ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS engineers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  github_login  TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('senior','mid','junior')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, github_login)
);

-- ── Sprints ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sprints (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  starts_at     TIMESTAMPTZ NOT NULL,
  ends_at       TIMESTAMPTZ NOT NULL
);

-- ── Pull requests ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pull_requests (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  github_pr_id         BIGINT NOT NULL,
  repo                 TEXT NOT NULL,
  pr_number            INT NOT NULL,
  title                TEXT NOT NULL,
  author_login         TEXT NOT NULL,
  base_branch          TEXT NOT NULL,
  opened_at            TIMESTAMPTZ NOT NULL,
  merged_at            TIMESTAMPTZ NOT NULL,
  first_review_at      TIMESTAMPTZ,
  cycle_time_hours     NUMERIC(8,2),
  is_ai_assisted       BOOLEAN NOT NULL DEFAULT FALSE,
  regression_label     TEXT NOT NULL DEFAULT 'pending'
                         CHECK (regression_label IN
                           ('ai_regression','manual_regression','clean','pending','unclassified')),
  classifier_reasoning TEXT,
  classified_at        TIMESTAMPTZ,
  jira_ticket_key      TEXT,
  jira_ticket_type     TEXT,
  UNIQUE (workspace_id, github_pr_id)
);

CREATE INDEX IF NOT EXISTS pull_requests_workspace_merged_idx
  ON pull_requests (workspace_id, merged_at DESC);

-- ── Webhook events (raw log for debugging / replay) ───────────────────────────
CREATE TABLE IF NOT EXISTS webhook_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
  event_type    TEXT NOT NULL,
  github_pr_id  BIGINT,
  payload       JSONB NOT NULL,
  processed     BOOLEAN NOT NULL DEFAULT FALSE,
  error         TEXT,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
