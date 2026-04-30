import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { upsertWorkspace } from '@/lib/workspace'

export async function POST(req) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'No active organization' }, { status: 400 })

  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  await upsertWorkspace({ id: orgId, name: name.trim() })
  return NextResponse.json({ ok: true })
}
