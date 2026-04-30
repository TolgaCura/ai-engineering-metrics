'use client'

import { useState } from 'react'

function GitHubSection({ hasToken }) {
  return (
    <div className="border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">GitHub</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {hasToken ? 'Connected — pull requests are being tracked.' : 'Not connected.'}
          </p>
        </div>
        <a
          href="/api/auth/github"
          className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-800"
        >
          {hasToken ? 'Reconnect' : 'Connect'}
        </a>
      </div>
    </div>
  )
}

function JiraSection({ jira, onSaved }) {
  const [form, setForm] = useState({
    domain: jira?.domain ?? '',
    email: jira?.email ?? '',
    token: '',
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  function update(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch('/api/onboarding/jira', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error')
      setMsg({ type: 'ok', text: 'Jira connected successfully.' })
      onSaved()
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border border-gray-200 rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">Jira</h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Subdomain</label>
          <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
            <input
              type="text"
              value={form.domain}
              onChange={update('domain')}
              placeholder="mycompany"
              className="flex-1 px-3 py-1.5 text-sm focus:outline-none"
            />
            <span className="px-2 py-1.5 text-xs text-gray-400 bg-gray-50 border-l border-gray-200">.atlassian.net</span>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
          <input type="email" value={form.email} onChange={update('email')}
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">API token</label>
          <input type="password" value={form.token} onChange={update('token')} placeholder="••••••••"
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      {msg && (
        <p className={`text-xs ${msg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>{msg.text}</p>
      )}
      <button type="submit" disabled={saving || !form.domain || !form.email || !form.token}
        className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50">
        {saving ? 'Saving…' : 'Save Jira credentials'}
      </button>
    </form>
  )
}

function InviteSection({ isAdmin }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState(null)

  async function handleInvite(e) {
    e.preventDefault()
    if (!email.trim()) return
    setSending(true)
    setMsg(null)
    try {
      const res = await fetch('/api/settings/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error')
      setMsg({ type: 'ok', text: `Invitation sent to ${email}.` })
      setEmail('')
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setSending(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Team members</h3>
        <p className="text-xs text-gray-500">Only admins can invite new members.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleInvite} className="border border-gray-200 rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">Invite team member</h3>
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="colleague@company.com"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
        <select
          value={role}
          onChange={e => setRole(e.target.value)}
          className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
        <button
          type="submit"
          disabled={sending || !email.trim()}
          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
        >
          {sending ? 'Sending…' : 'Send invite'}
        </button>
      </div>
      {msg && (
        <p className={`text-xs ${msg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>{msg.text}</p>
      )}
    </form>
  )
}

function MembersSection({ members }) {
  return (
    <div className="border border-gray-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Members</h3>
      {members.length === 0 && <p className="text-xs text-gray-500">No members found.</p>}
      <ul className="space-y-2">
        {members.map(m => (
          <li key={m.id} className="flex items-center gap-3">
            {m.imageUrl && (
              <img src={m.imageUrl} alt="" className="w-7 h-7 rounded-full" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 truncate">
                {m.firstName} {m.lastName}
              </p>
              <p className="text-xs text-gray-500 truncate">{m.identifier}</p>
            </div>
            <span className="text-xs text-gray-400 capitalize">
              {m.role === 'org:admin' ? 'Admin' : 'Member'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function SettingsClient({ isAdmin, orgName, ws, members }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Workspace settings</h1>
            <p className="text-sm text-gray-500">{orgName}</p>
          </div>
          <a href="/" className="text-sm text-blue-600 hover:underline">← Dashboard</a>
        </div>

        <div className="space-y-4">
          {isAdmin && <GitHubSection hasToken={ws?.hasGitHub} />}
          {isAdmin && <JiraSection jira={ws?.jira} onSaved={() => {}} />}
          <InviteSection isAdmin={isAdmin} />
          <MembersSection members={members} />
        </div>
      </div>
    </div>
  )
}
