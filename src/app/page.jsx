import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getWorkspace } from '@/lib/workspace'
import DashboardClient from './dashboard-client'

export default async function DashboardPage() {
  const { orgId, orgRole } = await auth()

  if (!orgId) redirect('/onboarding')

  const workspace = await getWorkspace(orgId)

  if (!workspace || !workspace.onboarding_complete) {
    redirect('/onboarding')
  }

  const isAdmin = orgRole === 'org:admin'

  return <DashboardClient isAdmin={isAdmin} orgName={workspace.name} />
}
