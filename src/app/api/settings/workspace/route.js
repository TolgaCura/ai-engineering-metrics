import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getWorkspace } from '@/lib/workspace'

export async function GET() {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ws = await getWorkspace(orgId)
  if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  return NextResponse.json({
    hasGitHub: !!ws.github_access_token,
    jira: ws.jira_domain
      ? { domain: ws.jira_domain, email: ws.jira_email }
      : null,
    webhookSecret: ws.webhook_secret,
    onboardingComplete: ws.onboarding_complete,
  })
}
