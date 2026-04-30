import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export async function POST(req) {
  const { orgId, orgRole } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (orgRole !== 'org:admin') {
    return NextResponse.json({ error: 'Only admins can invite members' }, { status: 403 })
  }

  const { email, role } = await req.json()
  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 })

  const inviteRole = role === 'admin' ? 'org:admin' : 'org:member'

  const client = await clerkClient()
  await client.organizations.createOrganizationInvitation({
    organizationId: orgId,
    emailAddress: email,
    role: inviteRole,
    redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/sign-up`,
  })

  return NextResponse.json({ ok: true })
}
