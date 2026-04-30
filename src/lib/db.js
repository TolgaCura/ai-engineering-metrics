import postgres from 'postgres'

// Cache the connection pool across Next.js hot-reloads in dev
const globalForDb = global

function getDb() {
  if (globalForDb._sql) return globalForDb._sql
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set')
  }
  const db = postgres(process.env.DATABASE_URL, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  })
  if (process.env.NODE_ENV !== 'production') globalForDb._sql = db
  return db
}

// Proxy so sql can be used as a tagged template literal without evaluating at module load time
const noop = () => {}
export const sql = new Proxy(noop, {
  apply(_target, _thisArg, args) {
    return getDb()(...args)
  },
  get(_target, prop) {
    const db = getDb()
    const val = db[prop]
    return typeof val === 'function' ? val.bind(db) : val
  },
})

// ── Queries ───────────────────────────────────────────────────────────────────

/** Upsert a PR row. Called by the webhook handler on every merge event. */
export async function upsertPR(workspaceId, pr) {
  await sql`
    INSERT INTO pull_requests ${sql({ ...pr, workspace_id: workspaceId })}
    ON CONFLICT (workspace_id, github_pr_id) DO UPDATE SET
      merged_at            = EXCLUDED.merged_at,
      cycle_time_hours     = EXCLUDED.cycle_time_hours,
      is_ai_assisted       = EXCLUDED.is_ai_assisted,
      jira_ticket_key      = EXCLUDED.jira_ticket_key,
      jira_ticket_type     = EXCLUDED.jira_ticket_type
  `
}

/** Write Claude's classification result back to the PR row. */
export async function saveClassification(workspaceId, githubPrId, label, reasoning) {
  await sql`
    UPDATE pull_requests
    SET regression_label     = ${label},
        classifier_reasoning = ${reasoning},
        classified_at        = NOW()
    WHERE workspace_id = ${workspaceId}
      AND github_pr_id = ${githubPrId}
  `
}

/** Leaderboard: per-engineer stats for a given date range. */
export async function getLeaderboard(workspaceId, from, to) {
  return sql`
    SELECT
      e.github_login,
      e.display_name,
      e.role,
      COUNT(pr.id)::int                                                      AS prs_merged,
      COUNT(pr.id) FILTER (WHERE pr.is_ai_assisted)::int                    AS ai_assisted_prs,
      ROUND(
        100.0 * COUNT(pr.id) FILTER (WHERE pr.is_ai_assisted)
              / NULLIF(COUNT(pr.id), 0), 1
      )                                                                      AS ai_pct,
      ROUND(AVG(pr.cycle_time_hours)::numeric, 1)                           AS avg_cycle_time_hours,
      COUNT(pr.id) FILTER (WHERE pr.regression_label = 'ai_regression')::int     AS regressions_ai,
      COUNT(pr.id) FILTER (WHERE pr.regression_label = 'manual_regression')::int AS regressions_manual,
      ROUND(
        100.0 * COUNT(pr.id) FILTER (
          WHERE pr.regression_label IN ('ai_regression','manual_regression')
        ) / NULLIF(
          COUNT(pr.id) FILTER (WHERE pr.regression_label != 'pending'), 0
        ), 1
      )                                                                      AS regression_rate
    FROM engineers e
    LEFT JOIN pull_requests pr
      ON pr.author_login = e.github_login
     AND pr.workspace_id = ${workspaceId}
     AND pr.merged_at BETWEEN ${from} AND ${to}
    WHERE e.workspace_id = ${workspaceId}
    GROUP BY e.github_login, e.display_name, e.role
    ORDER BY prs_merged DESC
  `
}

/** Team-level summary stats for the metric cards. */
export async function getTeamSummary(workspaceId, from, to) {
  const [row] = await sql`
    SELECT
      COUNT(*)::int                                                AS total_prs,
      COUNT(*) FILTER (WHERE is_ai_assisted)::int                 AS ai_prs,
      ROUND(AVG(cycle_time_hours)::numeric, 1)                    AS avg_cycle_time_hours,
      ROUND(
        100.0 * COUNT(*) FILTER (
          WHERE regression_label IN ('ai_regression','manual_regression')
        ) / NULLIF(
          COUNT(*) FILTER (WHERE regression_label != 'pending'), 0
        ), 1
      )                                                            AS regression_rate
    FROM pull_requests
    WHERE workspace_id = ${workspaceId}
      AND merged_at BETWEEN ${from} AND ${to}
  `
  return row
}

/** Sprints list for the sprint selector dropdown. */
export async function getSprints(workspaceId) {
  return sql`
    SELECT id, name, starts_at, ends_at
    FROM sprints
    WHERE workspace_id = ${workspaceId}
    ORDER BY starts_at DESC
    LIMIT 20
  `
}

/** Recent regressions for the flagged PRs panel. */
export async function getRecentRegressions(workspaceId, limit = 5) {
  return sql`
    SELECT pr.title, pr.pr_number, pr.repo, pr.author_login,
           pr.regression_label, pr.jira_ticket_key, pr.merged_at,
           e.display_name
    FROM pull_requests pr
    LEFT JOIN engineers e
      ON e.github_login = pr.author_login
     AND e.workspace_id = ${workspaceId}
    WHERE pr.workspace_id = ${workspaceId}
      AND pr.regression_label IN ('ai_regression','manual_regression')
    ORDER BY pr.merged_at DESC
    LIMIT ${limit}
  `
}
