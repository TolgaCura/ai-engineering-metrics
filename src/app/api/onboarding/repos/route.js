import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { requireWorkspace, setTrackedRepos, markOnboardingComplete } from '@/lib/workspace'
import { listUserRepos } from '@/lib/github'

export async function GET() {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ws = await requireWorkspace(orgId)
  if (!ws.github_access_token) {
    return NextResponse.json({ error: 'GitHub not connected' }, { status: 400 })
  }

  const repos = await listUserRepos(ws.github_access_token)
  return NextResponse.json({ repos })
}

export async function POST(req) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { repos } = await req.json()
  if (!Array.isArray(repos)) {
    return NextResponse.json({ error: 'repos must be an array' }, { status: 400 })
  }

  await setTrackedRepos(orgId, repos)
  await markOnboardingComplete(orgId)
  return NextResponse.json({ ok: true })
}
