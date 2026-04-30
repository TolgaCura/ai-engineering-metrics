import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a code review assistant that classifies whether a merged pull request is a regression bug, and if so, whether the bug was originally introduced by AI-assisted code.

You will be given:
- The PR title, description, and a diff summary
- The linked Jira ticket (if any)
- A list of recent AI-assisted PRs that previously touched the same files

Your job is to return a JSON object with exactly these fields:
{
  "label": "ai_regression" | "manual_regression" | "clean",
  "reasoning": "<one or two sentences explaining your decision>",
  "confidence": "high" | "medium" | "low"
}

Classification rules:
- "ai_regression": The PR fixes a bug, AND the bug was plausibly introduced by a prior AI-assisted PR on the same files.
- "manual_regression": The PR fixes a bug, but there is no clear link to prior AI-assisted code.
- "clean": The PR is a feature, improvement, refactor, or non-bug fix.

Only classify as a regression if the Jira ticket type is 'Bug' or the PR title/description clearly describes fixing a defect.
Return ONLY the JSON object — no markdown, no code fences, no preamble.`

export async function classifyPR({ pr, jiraTicket, priorAIPRs }) {
  const jiraSection = jiraTicket
    ? `## Linked Jira ticket\nTicket: ${jiraTicket.key}\nType: ${jiraTicket.type}\nSummary: ${jiraTicket.summary}\nDescription: ${jiraTicket.description.slice(0, 800)}`
    : `## Linked Jira ticket\nNone found.`

  const priorSection = priorAIPRs.length > 0
    ? `## Prior AI-assisted PRs on the same files\n` +
      priorAIPRs.map(p => `- PR #${p.pr_number} by ${p.author_login} (merged ${p.merged_at}): "${p.title}"`).join('\n')
    : `## Prior AI-assisted PRs on the same files\nNone found.`

  const userMessage = `## Pull request
Title: ${pr.title}
Author: ${pr.author_login} (AI-assisted: ${pr.is_ai_assisted ? 'yes' : 'no'})
Description:
${pr.body.slice(0, 1000)}

## Diff summary (truncated)
${pr.diff_summary}

${jiraSection}

${priorSection}

Classify this PR.`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  })

  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim()

  try {
    const parsed = JSON.parse(text)
    if (!['ai_regression', 'manual_regression', 'clean'].includes(parsed.label)) {
      throw new Error(`Unexpected label: ${parsed.label}`)
    }
    return parsed
  } catch {
    console.error('Classifier parse error. Raw response:', text)
    return { label: 'clean', reasoning: 'Classification failed — defaulting to clean.', confidence: 'low' }
  }
}
