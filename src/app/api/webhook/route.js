import { NextResponse } from 'next/server'
import { verifyWebhookSignature, getPRFiles, getDiffSummary, detectAIAssisted, findPriorAIPRsOnSameFiles, extractJiraKey, getFirstReviewAt } from '@/lib/github'
import { getIssue, extractDescriptionText } from '@/lib/jira'
import { sql, upsertPR, saveClassification } from '@/lib/db'
import { classifyPR } from '@/lib/classifier'
import { getWorkspaceIdByRepo, getWorkspace } from '@/lib/workspace'

export async function POST(req) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-hub-signature-256')
  const eventType = req.headers.get('x-github-event')

  if (eventType !== 'pull_request') return NextResponse.json({ ok: true, skipped: true })

  const payload = JSON.parse(rawBody)
  if (payload.action !== 'closed' || !payload.pull_request.merged_at) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const ghPR = payload.pull_request
  const repo = ghPR.base.repo.full_name
  const prNumber = ghPR.number

  // Route to the correct workspace by matching the repo
  const workspaceId = await getWorkspaceIdByRepo(repo)
  if (!workspaceId) return NextResponse.json({ ok: true, skipped: true, reason: 'untracked repo' })

  const workspace = await getWorkspace(workspaceId)
  if (!workspace) return NextResponse.json({ ok: true, skipped: true, reason: 'workspace not found' })

  // Verify per-workspace webhook secret
  const valid = await verifyWebhookSignature(rawBody, signature, workspace.webhook_secret)
  if (!valid) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })

  const ghToken = workspace.github_access_token

  // Log the raw event for debugging/replay
  await sql`
    INSERT INTO webhook_events (workspace_id, event_type, github_pr_id, payload)
    VALUES (${workspaceId}, ${eventType}, ${ghPR.id}, ${payload})
  `

  try {
    const [firstReviewAt, isAIAssisted, changedFiles, diffSummary] = await Promise.all([
      getFirstReviewAt(repo, prNumber, ghToken),
      detectAIAssisted(repo, prNumber, ghPR, ghToken),
      getPRFiles(repo, prNumber, ghToken).then(files => files.map(f => f.filename)),
      getDiffSummary(repo, prNumber, ghToken),
    ])

    const openedAt = new Date(ghPR.created_at)
    const mergedAt = new Date(ghPR.merged_at)
    const cycleTimeHours = Math.round(((mergedAt - openedAt) / 3_600_000) * 100) / 100

    const jiraKey = extractJiraKey(ghPR.title + ' ' + (ghPR.body ?? ''))
    let jiraTicketType = null
    let jiraForClassifier = null

    if (jiraKey && workspace.jira_domain) {
      const jiraCreds = {
        domain: workspace.jira_domain,
        email: workspace.jira_email,
        token: workspace.jira_api_token,
      }
      const issue = await getIssue(jiraKey, jiraCreds)
      if (issue) {
        jiraTicketType = issue.fields.issuetype.name
        jiraForClassifier = {
          key: issue.key,
          type: jiraTicketType,
          summary: issue.fields.summary,
          description: extractDescriptionText(issue),
        }
      }
    }

    await upsertPR(workspaceId, {
      github_pr_id: ghPR.id,
      repo,
      pr_number: prNumber,
      title: ghPR.title,
      author_login: ghPR.user.login,
      base_branch: ghPR.base.ref,
      opened_at: openedAt,
      merged_at: mergedAt,
      first_review_at: firstReviewAt,
      cycle_time_hours: cycleTimeHours,
      is_ai_assisted: isAIAssisted,
      regression_label: 'pending',
      classifier_reasoning: null,
      classified_at: null,
      jira_ticket_key: jiraKey,
      jira_ticket_type: jiraTicketType,
    })

    const recentAIPRs = await sql`
      SELECT pr_number, title, author_login,
             TO_CHAR(merged_at, 'YYYY-MM-DD') AS merged_at, repo
      FROM pull_requests
      WHERE workspace_id = ${workspaceId}
        AND is_ai_assisted = TRUE
        AND merged_at < ${mergedAt}
        AND repo = ${repo}
      ORDER BY merged_at DESC
      LIMIT 30
    `

    const priorAIPRs = await findPriorAIPRsOnSameFiles(changedFiles, recentAIPRs, ghToken)

    const result = await classifyPR({
      pr: {
        title: ghPR.title,
        body: ghPR.body ?? '',
        diff_summary: diffSummary,
        author_login: ghPR.user.login,
        is_ai_assisted: isAIAssisted,
      },
      jiraTicket: jiraForClassifier,
      priorAIPRs,
    })

    await saveClassification(workspaceId, ghPR.id, result.label, result.reasoning)
    await sql`
      UPDATE webhook_events SET processed = TRUE
      WHERE workspace_id = ${workspaceId}
        AND github_pr_id = ${ghPR.id}
        AND processed = FALSE
    `

    return NextResponse.json({ ok: true, label: result.label })
  } catch (err) {
    console.error('Webhook processing error:', err)
    await sql`
      UPDATE webhook_events SET error = ${String(err)}
      WHERE workspace_id = ${workspaceId}
        AND github_pr_id = ${ghPR.id}
        AND processed = FALSE
    `
    return NextResponse.json({ ok: false, error: String(err) })
  }
}
