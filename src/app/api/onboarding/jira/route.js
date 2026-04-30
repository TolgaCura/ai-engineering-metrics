import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { saveJiraCredentials } from '@/lib/workspace'
import { testJiraConnection } from '@/lib/jira'

export async function POST(req) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { domain, email, token } = await req.json()
  if (!domain || !email || !token) {
    return NextResponse.json({ error: 'domain, email, and token are required' }, { status: 400 })
  }

  const valid = await testJiraConnection({ domain, email, token })
  if (!valid) {
    return NextResponse.json({ error: 'Invalid Jira credentials' }, { status: 422 })
  }

  await saveJiraCredentials(orgId, { domain, email, token })
  return NextResponse.json({ ok: true })
}
