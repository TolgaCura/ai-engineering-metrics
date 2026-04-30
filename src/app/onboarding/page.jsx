'use client'

import { useOrganization, useClerk } from '@clerk/nextjs'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'

// ── Step 1: Create / name the workspace ──────────────────────────────────────
function StepWorkspace({ onDone }) {
  const { createOrganization, setActive } = useClerk()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const org = await createOrganization({ name: name.trim() })
      await setActive({ organization: org.id })
      await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      onDone()
    } catch (err) {
      setError(err.message ?? 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Workspace name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Acme Engineering"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
        <p className="text-xs text-gray-500 mt-1">Usually your company or team name.</p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={saving || !name.trim()}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? 'Creating…' : 'Create workspace'}
      </button>
    </form>
  )
}

// ── Step 2: Connect GitHub ────────────────────────────────────────────────────
function StepGitHub({ error, onSkip }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Connect your GitHub account so we can track pull requests and run the regression classifier.
      </p>
      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">
          GitHub connection failed — please try again.
        </p>
      )}
      <a
        href="/api/auth/github"
        className="flex items-center justify-center gap-2 w-full bg-gray-900 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-gray-800"
      >
        <svg viewBox="0 0 16 16" className="w-4 h-4 fill-current" aria-hidden="true">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
        </svg>
        Connect GitHub
      </a>
    </div>
  )
}

// ── Step 3: Connect Jira (optional) ──────────────────────────────────────────
function StepJira({ onDone, onSkip }) {
  const [form, setForm] = useState({ domain: '', email: '', token: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function update(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/onboarding/jira', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Invalid credentials')
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-gray-600">
        Optional: connect Jira so the classifier can check ticket types when assessing regressions.
      </p>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Jira subdomain</label>
        <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
          <input
            type="text"
            value={form.domain}
            onChange={update('domain')}
            placeholder="mycompany"
            className="flex-1 px-3 py-2 text-sm focus:outline-none"
          />
          <span className="px-3 py-2 text-sm text-gray-500 bg-gray-50 border-l border-gray-300">.atlassian.net</span>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Atlassian email</label>
        <input
          type="email"
          value={form.email}
          onChange={update('email')}
          placeholder="you@company.com"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">API token</label>
        <input
          type="password"
          value={form.token}
          onChange={update('token')}
          placeholder="Your Atlassian API token"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-500 mt-1">
          Generate one at{' '}
          <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noreferrer" className="text-blue-600 underline">
            id.atlassian.com
          </a>
        </p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving || !form.domain || !form.email || !form.token}
          className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Connecting…' : 'Connect Jira'}
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
        >
          Skip
        </button>
      </div>
    </form>
  )
}

// ── Step 4: Select repos ──────────────────────────────────────────────────────
function StepRepos({ onDone }) {
  const [repos, setRepos] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetch('/api/onboarding/repos')
      .then(r => r.json())
      .then(d => setRepos(d.repos ?? []))
      .catch(() => setError('Failed to load repositories'))
  }, [])

  function toggle(fullName) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(fullName) ? next.delete(fullName) : next.add(fullName)
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/onboarding/repos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repos: [...selected] }),
      })
      if (!res.ok) throw new Error('Failed to save repos')
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const filtered = repos?.filter(r =>
    r.full_name.toLowerCase().includes(query.toLowerCase())
  ) ?? []

  if (!repos) {
    return <p className="text-sm text-gray-500">Loading repositories…</p>
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Select the repositories you want to track. We'll classify merged PRs automatically.
      </p>
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Filter repos…"
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
        {filtered.length === 0 && (
          <p className="px-3 py-2 text-sm text-gray-500">No repos found.</p>
        )}
        {filtered.map(r => (
          <label key={r.full_name} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.has(r.full_name)}
              onChange={() => toggle(r.full_name)}
              className="rounded border-gray-300 text-blue-600"
            />
            <span className="text-sm font-mono text-gray-900">{r.full_name}</span>
            {r.private && <span className="text-xs text-gray-400 ml-auto">private</span>}
          </label>
        ))}
      </div>
      {selected.size > 0 && (
        <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-800">
          <strong>Webhook URL to configure in GitHub:</strong>
          <code className="block mt-1 font-mono break-all">
            {process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin}/api/webhook
          </code>
          <p className="mt-1 text-blue-600">
            Go to each repo → Settings → Webhooks → Add webhook. Set content type to <code>application/json</code>.
          </p>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        onClick={handleSave}
        disabled={saving || selected.size === 0}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? 'Saving…' : `Track ${selected.size} repo${selected.size !== 1 ? 's' : ''}`}
      </button>
    </div>
  )
}

// ── Main onboarding page ──────────────────────────────────────────────────────
const STEPS = [
  { title: 'Create workspace', description: 'Name your team workspace' },
  { title: 'Connect GitHub', description: 'Authorize access to your repositories' },
  { title: 'Connect Jira', description: 'Optional — for ticket-based classification' },
  { title: 'Select repos', description: 'Choose which repos to track' },
]

function OnboardingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const initialStep = Number(searchParams.get('step') ?? 1)
  const [step, setStep] = useState(initialStep)
  const githubError = searchParams.get('error')?.includes('github')

  // If returning from GitHub OAuth, advance to step 3
  useEffect(() => {
    if (searchParams.get('step') === '3') setStep(3)
  }, [searchParams])

  function next() { setStep(s => s + 1) }
  function goToDashboard() { router.push('/') }

  return (
    <div className="w-full max-w-md">
      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                i + 1 < step ? 'bg-blue-600 text-white' :
                i + 1 === step ? 'bg-blue-600 text-white ring-4 ring-blue-100' :
                'bg-gray-200 text-gray-500'
              }`}>
                {i + 1 < step ? '✓' : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 w-16 mx-1 ${i + 1 < step ? 'bg-blue-600' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <h1 className="text-lg font-semibold text-gray-900 mb-1">
          {STEPS[step - 1]?.title}
        </h1>
        <p className="text-sm text-gray-500 mb-6">{STEPS[step - 1]?.description}</p>

        {step === 1 && <StepWorkspace onDone={next} />}
        {step === 2 && <StepGitHub error={githubError} onSkip={next} />}
        {step === 3 && <StepJira onDone={next} onSkip={next} />}
        {step === 4 && <StepRepos onDone={goToDashboard} />}
      </div>
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-sm text-gray-400">Loading…</div>}>
        <OnboardingContent />
      </Suspense>
    </div>
  )
}
