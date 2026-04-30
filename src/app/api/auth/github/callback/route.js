import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { saveGitHubToken } from '@/lib/workspace'

export async function GET(req) {
  const { orgId } = await auth()
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  if (!orgId || !code || state !== orgId) {
    return NextResponse.redirect(new URL('/onboarding?error=github_auth_failed', req.url))
  }

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/github/callback`,
    }),
  })

  const data = await tokenRes.json()
  if (!data.access_token) {
    return NextResponse.redirect(new URL('/onboarding?error=github_token_failed', req.url))
  }

  await saveGitHubToken(orgId, data.access_token)
  return NextResponse.redirect(new URL('/onboarding?step=3', req.url))
}
