function jiraHeaders({ email, token }) {
  const creds = Buffer.from(`${email}:${token}`).toString('base64')
  return {
    Authorization: `Basic ${creds}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
}

async function jiraFetch(path, credentials) {
  const base = `https://${credentials.domain}.atlassian.net/rest/api/3`
  const res = await fetch(`${base}${path}`, { headers: jiraHeaders(credentials) })
  if (!res.ok) throw new Error(`Jira API ${path} → ${res.status} ${res.statusText}`)
  return res.json()
}

export async function getIssue(ticketKey, credentials) {
  try {
    return await jiraFetch(`/issue/${ticketKey}`, credentials)
  } catch {
    return null
  }
}

/** Extracts plain text from Jira's Atlassian Document Format (ADF) description. */
export function extractDescriptionText(issue) {
  if (!issue.fields.description) return ''
  try {
    return issue.fields.description.content
      .flatMap(block => block.content ?? [])
      .map(node => node.text ?? '')
      .join(' ')
      .slice(0, 1000)
  } catch {
    return ''
  }
}

/** Tests whether credentials are valid by fetching the current user. */
export async function testJiraConnection(credentials) {
  const base = `https://${credentials.domain}.atlassian.net/rest/api/3`
  const res = await fetch(`${base}/myself`, { headers: jiraHeaders(credentials) })
  return res.ok
}
