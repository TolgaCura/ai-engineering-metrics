import { sql } from './db.js'
import { encrypt, decrypt } from './crypto.js'

/** Returns the workspace row for a Clerk org ID, or null if not found. */
export async function getWorkspace(orgId) {
  const [row] = await sql`
    SELECT id, name, github_access_token, jira_domain, jira_email,
           jira_api_token, webhook_secret, onboarding_complete
    FROM workspaces
    WHERE id = ${orgId}
  `
  if (!row) return null
  return {
    ...row,
    github_access_token: row.github_access_token ? decrypt(row.github_access_token) : null,
    jira_api_token: row.jira_api_token ? decrypt(row.jira_api_token) : null,
  }
}

/** Like getWorkspace but throws a 404-style error if missing. */
export async function requireWorkspace(orgId) {
  const ws = await getWorkspace(orgId)
  if (!ws) throw Object.assign(new Error('Workspace not found'), { status: 404 })
  return ws
}

/** Inserts or updates the workspace row (called during onboarding step 1). */
export async function upsertWorkspace({ id, name }) {
  await sql`
    INSERT INTO workspaces (id, name)
    VALUES (${id}, ${name})
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
  `
}

/** Stores the GitHub OAuth access token (encrypted). */
export async function saveGitHubToken(orgId, token) {
  await sql`
    UPDATE workspaces
    SET github_access_token = ${encrypt(token)}
    WHERE id = ${orgId}
  `
}

/** Stores Jira credentials (token encrypted). */
export async function saveJiraCredentials(orgId, { domain, email, token }) {
  await sql`
    UPDATE workspaces
    SET jira_domain    = ${domain},
        jira_email     = ${email},
        jira_api_token = ${encrypt(token)}
    WHERE id = ${orgId}
  `
}

/** Marks onboarding as complete for a workspace. */
export async function markOnboardingComplete(orgId) {
  await sql`
    UPDATE workspaces SET onboarding_complete = TRUE WHERE id = ${orgId}
  `
}

/** Returns the list of repo full names tracked by a workspace. */
export async function getTrackedRepos(orgId) {
  const rows = await sql`
    SELECT repo_full_name FROM tracked_repos WHERE workspace_id = ${orgId}
  `
  return rows.map(r => r.repo_full_name)
}

/** Replaces the tracked repos for a workspace (delete-then-insert). */
export async function setTrackedRepos(orgId, repoFullNames) {
  await sql`DELETE FROM tracked_repos WHERE workspace_id = ${orgId}`
  if (repoFullNames.length === 0) return
  const rows = repoFullNames.map(r => ({ workspace_id: orgId, repo_full_name: r }))
  await sql`INSERT INTO tracked_repos ${sql(rows)}`
}

/** Looks up a workspace ID by repo full name (used in webhook routing). */
export async function getWorkspaceIdByRepo(repoFullName) {
  const [row] = await sql`
    SELECT workspace_id FROM tracked_repos
    WHERE repo_full_name = ${repoFullName}
    LIMIT 1
  `
  return row?.workspace_id ?? null
}
