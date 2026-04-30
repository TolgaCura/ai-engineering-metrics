import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { sql, getLeaderboard, getTeamSummary, getSprints, getRecentRegressions } from '@/lib/db'

export async function GET(req) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const view = searchParams.get('view') ?? 'sprint'

  try {
    let from, to

    if (view === 'sprint') {
      const sprintId = searchParams.get('sprintId')
      if (sprintId) {
        const [sprint] = await sql`
          SELECT starts_at, ends_at FROM sprints
          WHERE id = ${sprintId} AND workspace_id = ${orgId}
        `
        if (!sprint) return NextResponse.json({ error: 'Sprint not found' }, { status: 404 })
        from = new Date(sprint.starts_at)
        to = new Date(sprint.ends_at)
      } else {
        const [latest] = await sql`
          SELECT starts_at, ends_at FROM sprints
          WHERE workspace_id = ${orgId}
          ORDER BY starts_at DESC LIMIT 1
        `
        if (latest) {
          from = new Date(latest.starts_at)
          to = new Date(latest.ends_at)
        } else {
          to = new Date()
          from = new Date(Date.now() - 14 * 24 * 3_600_000)
        }
      }
    } else if (view === 'month') {
      const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7)
      from = new Date(`${month}-01T00:00:00Z`)
      to = new Date(from.getFullYear(), from.getMonth() + 1, 0, 23, 59, 59)
    } else {
      const year = searchParams.get('year') ?? new Date().getFullYear().toString()
      from = new Date(`${year}-01-01T00:00:00Z`)
      to = new Date(`${year}-12-31T23:59:59Z`)
    }

    const [leaderboard, summary, sprints, regressions] = await Promise.all([
      getLeaderboard(orgId, from, to),
      getTeamSummary(orgId, from, to),
      getSprints(orgId),
      getRecentRegressions(orgId, 5),
    ])

    return NextResponse.json({
      period: { from: from.toISOString(), to: to.toISOString(), view },
      summary,
      leaderboard,
      sprints,
      regressions,
    })
  } catch (err) {
    console.error('Metrics API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
