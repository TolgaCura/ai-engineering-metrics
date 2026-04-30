import { auth, clerkClient } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getWorkspace } from '@/lib/workspace'
import SettingsClient from './settings-client'

export default async function SettingsPage() {
  const { orgId, orgRole } = await auth()

  if (!orgId) redirect('/sign-in')

  const isAdmin = orgRole === 'org:admin'
  const workspace = await getWorkspace(orgId)

  let members = []
  try {
    const client = await clerkClient()
    const result = await client.organizations.getOrganizationMembershipList({ organizationId: orgId })
    members = result.data.map(m => ({
      id: m.id,
      role: m.role,
      firstName: m.publicUserData?.firstName ?? '',
      lastName: m.publicUserData?.lastName ?? '',
      identifier: m.publicUserData?.identifier ?? '',
      imageUrl: m.publicUserData?.imageUrl ?? null,
    }))
  } catch {}

  const ws = workspace ? {
    hasGitHub: !!workspace.github_access_token,
    jira: workspace.jira_domain ? {
      domain: workspace.jira_domain,
      email: workspace.jira_email,
    } : null,
  } : null

  return (
    <SettingsClient
      isAdmin={isAdmin}
      orgName={workspace?.name ?? ''}
      ws={ws}
      members={members}
    />
  )
}
