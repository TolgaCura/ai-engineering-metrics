import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export async function GET() {
  const { orgId } = await auth()
  if (!orgId) return new Response('Unauthorized', { status: 401 })

  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/github/callback`,
    scope: 'repo read:org',
    state: orgId,
  })

  redirect(`https://github.com/login/oauth/authorize?${params}`)
}
