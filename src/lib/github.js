const BASE = 'https://api.github.com'

function ghHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

async function ghFetch(path, token) {
  const res = await fetch(`${BASE}${path}`, { headers: ghHeaders(token) })
  if (!res.ok) throw new Error(`GitHub API ${path} → ${res.status} ${res.statusText}`)
  return res.json()
}

export async function getPR(repo, prNumber, token) {
  return ghFetch(`/repos/${repo}/pulls/${prNumber}`, token)
}

export async function getFirstReviewAt(repo, prNumber, token) {
  const reviews = await ghFetch(`/repos/${repo}/pulls/${prNumber}/reviews`, token)
  if (!reviews.length) return null
  return reviews
    .map(r => new Date(r.submitted_at))
    .sort((a, b) => a - b)[0]
}

export async function getPRFiles(repo, prNumber, token) {
  return ghFetch(`/repos/${repo}/pulls/${prNumber}/files`, token)
}

/** Returns a condensed diff string (max 6000 chars) for the classifier prompt. */
export async function getDiffSummary(repo, prNumber, token) {
  const files = await getPRFiles(repo, prNumber, token)
  const lines = []
  for (const f of files) {
    lines.push(`--- ${f.filename} (${f.status})`)
    if (f.patch) lines.push(f.patch.slice(0, 800))
  }
  return lines.join('\n').slice(0, 6000)
}

/**
 * Detects whether a PR was authored with Claude Code.
 * Checks for: claude-code label, Co-authored-by trailer, or "claude code" in body/commits.
 */
export async function detectAIAssisted(repo, prNumber, pr, token) {
  if (pr.labels.some(l => l.name.toLowerCase().includes('claude'))) return true

  const body = pr.body ?? ''
  if (body.includes('Co-authored-by: Claude') || body.toLowerCase().includes('claude code')) return true

  try {
    const commits = await ghFetch(`/repos/${repo}/pulls/${prNumber}/commits`, token)
    for (const c of commits) {
      const msg = c.commit.message
      if (
        msg.includes('Co-authored-by: Claude') ||
        msg.toLowerCase().includes('claude code') ||
        msg.includes('🤖')
      ) return true
    }
  } catch { /* non-fatal */ }

  return false
}

/**
 * Returns prior AI-assisted PRs that touched any of the same files as the current PR.
 */
export async function findPriorAIPRsOnSameFiles(changedFiles, allAIPRs, token) {
  const results = []
  for (const aiPR of allAIPRs.slice(0, 20)) {
    try {
      const files = await getPRFiles(aiPR.repo, aiPR.pr_number, token)
      const touched = files.map(f => f.filename)
      if (changedFiles.some(f => touched.includes(f))) results.push(aiPR)
    } catch { /* skip */ }
  }
  return results
}

/** Parses a Jira ticket key (e.g. ENG-123) from a string. */
export function extractJiraKey(text) {
  const match = text.match(/\b([A-Z]{2,10}-\d+)\b/)
  return match ? match[1] : null
}

/** Validates a GitHub webhook HMAC-SHA256 signature against a per-workspace secret. */
export async function verifyWebhookSignature(body, signature, secret) {
  if (!signature) return false
  if (!secret) return true

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
  const expected = 'sha256=' + Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0')).join('')

  if (expected.length !== signature.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  }
  return diff === 0
}

/** Lists repos accessible to the authenticated user (for onboarding repo selection). */
export async function listUserRepos(token) {
  const results = []
  let page = 1
  while (results.length < 200) {
    const batch = await ghFetch(`/user/repos?per_page=100&page=${page}&sort=updated`, token)
    if (!batch.length) break
    results.push(...batch.map(r => ({
      full_name: r.full_name,
      private: r.private,
      description: r.description ?? '',
    })))
    if (batch.length < 100) break
    page++
  }
  return results
}
