'use client'

import { UserButton } from '@clerk/nextjs'
import { useEffect, useState, useCallback } from 'react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

const AVATAR_COLORS = [
  'bg-purple-100 text-purple-800',
  'bg-blue-100 text-blue-800',
  'bg-amber-100 text-amber-800',
  'bg-teal-100 text-teal-800',
  'bg-gray-100 text-gray-600',
]

function avatarColor(login) {
  return AVATAR_COLORS[login.charCodeAt(0) % AVATAR_COLORS.length]
}

function regressionBarColor(rate) {
  if (rate <= 10) return 'bg-teal-500'
  if (rate <= 20) return 'bg-amber-400'
  return 'bg-red-500'
}

function regressionTextColor(rate) {
  if (rate <= 10) return 'text-teal-700'
  if (rate <= 20) return 'text-amber-700'
  return 'text-red-700'
}

function aiPillClass(pct) {
  if (pct >= 65) return 'bg-teal-100 text-teal-800'
  if (pct >= 40) return 'bg-amber-100 text-amber-800'
  return 'bg-gray-100 text-gray-600'
}

function formatHours(h) {
  if (h == null) return '—'
  if (h < 24) return `${Math.round(h)}h`
  return `${(h / 24).toFixed(1)}d`
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardClient({ isAdmin, orgName }) {
  const [view, setView] = useState('sprint')
  const [selectedSprintId, setSelectedSprintId] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ view })
      if (view === 'sprint' && selectedSprintId) params.set('sprintId', selectedSprintId)
      const res = await fetch(`/api/metrics?${params}`)
      if (!res.ok) throw new Error('Failed to load metrics')
      setData(await res.json())
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [view, selectedSprintId])

  useEffect(() => { fetchData() }, [fetchData])

  const summary     = data?.summary
  const leaderboard = data?.leaderboard ?? []
  const sprints     = data?.sprints ?? []
  const regressions = data?.regressions ?? []

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-medium text-gray-900">Engineering metrics</h1>
            <p className="text-sm text-gray-500 mt-1">
              {orgName} · Claude Code usage · PRs shipped · regression rates
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {['sprint', 'month', 'year'].map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    view === v
                      ? 'bg-white border border-gray-200 text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
            {isAdmin && (
              <a href="/settings" className="text-sm text-gray-500 hover:text-gray-800 px-2 py-1.5">
                Settings
              </a>
            )}
            <UserButton afterSignOutUrl="/sign-in" />
          </div>
        </div>

        {/* Sprint selector */}
        {view === 'sprint' && sprints.length > 0 && (
          <div className="flex items-center gap-3 mb-6 text-sm text-gray-500">
            <label htmlFor="sprint-select">Sprint</label>
            <select
              id="sprint-select"
              value={selectedSprintId}
              onChange={e => setSelectedSprintId(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-gray-800 text-sm bg-white"
            >
              <option value="">Latest</option>
              {sprints.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {sprints[0] && (
              <span className="text-gray-400">
                {new Date(sprints[0].starts_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                {' – '}
                {new Date(sprints[0].ends_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100">{error}</div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'PRs merged', value: summary?.total_prs ?? '—' },
            { label: 'Avg cycle time', value: formatHours(summary?.avg_cycle_time_hours ?? null) },
            {
              label: 'AI-assisted PRs',
              value: summary?.ai_prs ?? '—',
              sub: summary && summary.total_prs > 0
                ? `${Math.round((summary.ai_prs / summary.total_prs) * 100)}% of total`
                : null,
            },
            {
              label: 'Regression rate',
              value: summary?.regression_rate != null ? `${summary.regression_rate}%` : '—',
            },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="text-xs text-gray-400 mb-2">{card.label}</div>
              <div className="text-2xl font-medium text-gray-900">{loading ? '—' : card.value}</div>
              {card.sub && <div className="text-xs text-gray-400 mt-1">{card.sub}</div>}
            </div>
          ))}
        </div>

        {/* Empty state */}
        {!loading && leaderboard.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center mb-6">
            <p className="text-gray-500 text-sm">No data yet for this period.</p>
            <p className="text-gray-400 text-xs mt-2">
              Merge a pull request in a tracked repo to see it here.{' '}
              {isAdmin && (
                <a href="/settings" className="text-blue-600 hover:underline">Check your webhook setup →</a>
              )}
            </p>
          </div>
        )}

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <div className="mb-6">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-3">Leaderboard</div>
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="grid grid-cols-[200px_1fr_1fr_1fr_1fr] gap-4 px-5 py-3 text-xs text-gray-400 border-b border-gray-50 bg-gray-50">
                <div>Engineer</div>
                <div>PRs merged</div>
                <div>Claude usage</div>
                <div>Cycle time</div>
                <div>Regression rate</div>
              </div>

              {loading ? (
                <div className="px-5 py-12 text-center text-sm text-gray-400">Loading…</div>
              ) : leaderboard.map(eng => (
                <div
                  key={eng.github_login}
                  className="grid grid-cols-[200px_1fr_1fr_1fr_1fr] gap-4 px-5 py-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors items-center"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${avatarColor(eng.github_login)}`}>
                      {initials(eng.display_name)}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{eng.display_name}</div>
                      <div className="text-xs text-gray-400 capitalize">{eng.role ?? ''}</div>
                    </div>
                  </div>

                  <div className="text-sm text-gray-800">{eng.prs_merged}</div>

                  <div>
                    <span className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-full ${aiPillClass(Number(eng.ai_pct))}`}>
                      {eng.ai_pct ?? 0}% AI
                    </span>
                  </div>

                  <div className="text-sm text-gray-800">{formatHours(eng.avg_cycle_time_hours)}</div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${regressionBarColor(Number(eng.regression_rate))}`}
                        style={{ width: `${Math.min(Number(eng.regression_rate ?? 0), 100)}%` }}
                      />
                    </div>
                    <span className={`text-xs w-8 text-right ${regressionTextColor(Number(eng.regression_rate))}`}>
                      {eng.regression_rate ?? 0}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom panels */}
        {leaderboard.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* AI vs manual bar chart */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="text-sm font-medium text-gray-800 mb-4">AI vs manual PRs by engineer</div>
              {loading ? (
                <div className="h-32 flex items-center justify-center text-sm text-gray-400">Loading…</div>
              ) : (
                <div className="space-y-3">
                  {leaderboard.map(eng => (
                    <div key={eng.github_login} className="flex items-center gap-3 text-sm">
                      <div className="w-16 text-xs text-gray-500 truncate">{eng.display_name.split(' ')[0]}</div>
                      <div className="flex-1 flex gap-0.5 h-5 rounded overflow-hidden bg-gray-100">
                        <div
                          className="bg-teal-500 h-full"
                          style={{ width: eng.prs_merged > 0 ? `${(eng.ai_assisted_prs / eng.prs_merged) * 100}%` : '0%' }}
                          title={`${eng.ai_assisted_prs} AI`}
                        />
                        <div
                          className="bg-gray-200 h-full"
                          style={{ width: eng.prs_merged > 0 ? `${((eng.prs_merged - eng.ai_assisted_prs) / eng.prs_merged) * 100}%` : '0%' }}
                          title={`${eng.prs_merged - eng.ai_assisted_prs} manual`}
                        />
                      </div>
                      <div className="text-xs text-gray-400 w-6 text-right">{eng.prs_merged}</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-4 mt-4 text-xs text-gray-400">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-teal-500 inline-block" />AI-assisted</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-gray-200 inline-block" />Manual</span>
              </div>
            </div>

            {/* Recent regressions */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="text-sm font-medium text-gray-800 mb-4">Recent regressions flagged</div>
              {loading ? (
                <div className="h-32 flex items-center justify-center text-sm text-gray-400">Loading…</div>
              ) : regressions.length === 0 ? (
                <div className="h-32 flex items-center justify-center text-sm text-gray-400">No regressions flagged.</div>
              ) : (
                <div className="space-y-2">
                  {regressions.map((r, i) => (
                    <div key={i} className="flex items-start justify-between gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                      <div className="min-w-0">
                        <div className="text-sm text-gray-800 truncate">{r.title}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {r.display_name} · PR #{r.pr_number}
                          {r.jira_ticket_key && ` · ${r.jira_ticket_key}`}
                        </div>
                      </div>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${
                        r.regression_label === 'ai_regression'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {r.regression_label === 'ai_regression' ? 'AI regression' : 'Manual'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
