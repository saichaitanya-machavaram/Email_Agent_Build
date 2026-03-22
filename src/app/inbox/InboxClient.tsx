'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Email {
  gmail_id: string
  from_name: string
  from_email: string
  subject: string
  body_text: string
  received_at: string
  is_replied: boolean
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (mins > 0) return `${mins}m ago`
  return 'just now'
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

export default function InboxClient({ userEmail }: { userEmail: string }) {
  const [emails, setEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [selected, setSelected] = useState<Email | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const fetchFromDB = async () => {
    const { data } = await supabase
      .from('emails')
      .select('*')
      .eq('is_replied', false)
      .order('received_at', { ascending: false })
      .limit(50)
    if (data) setEmails(data)
  }

  const syncGmail = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/gmail/inbox')
      const data = await res.json()
      if (!data.error) await fetchFromDB()
    } finally {
      setSyncing(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await syncGmail()
      setLoading(false)
    }
    init()
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow">E</div>
          <span className="text-slate-900 font-bold text-lg tracking-tight">Email Agent</span>
          {emails.length > 0 && (
            <span className="bg-blue-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full">{emails.length}</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-slate-400 text-sm hidden sm:block">{userEmail}</span>
          <button
            onClick={syncGmail}
            disabled={syncing}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-40 transition-colors"
          >
            <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {syncing ? 'Syncing...' : 'Sync'}
          </button>
          <button onClick={handleSignOut} className="text-sm text-slate-400 hover:text-slate-700 transition-colors">
            Sign out
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Email list */}
        <div className={`${selected ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-96 bg-white border-r border-slate-200 overflow-y-auto`}>
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Unread — Primary Inbox</h2>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-slate-400 text-sm">Loading emails...</p>
              </div>
            </div>
          ) : emails.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center px-6">
                <div className="text-4xl mb-3">📭</div>
                <p className="text-slate-700 font-medium">All caught up</p>
                <p className="text-slate-400 text-sm mt-1">No unread emails in primary inbox</p>
              </div>
            </div>
          ) : (
            emails.map((email) => (
              <button
                key={email.gmail_id}
                onClick={() => setSelected(email)}
                className={`text-left px-4 py-4 border-b border-slate-100 hover:bg-slate-50 transition-colors ${selected?.gmail_id === email.gmail_id ? 'bg-blue-50 border-l-2 border-l-blue-600' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    {getInitials(email.from_name || email.from_email)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-slate-900 text-sm font-semibold truncate">{email.from_name || email.from_email}</span>
                      <span className="text-slate-400 text-xs shrink-0">{timeAgo(email.received_at)}</span>
                    </div>
                    <p className="text-slate-600 text-sm truncate mb-0.5">{email.subject || '(no subject)'}</p>
                    <p className="text-slate-400 text-xs truncate">{email.body_text?.slice(0, 80)}</p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Email detail */}
        <div className="flex-1 flex flex-col overflow-y-auto bg-slate-50">
          {selected ? (
            <div className="flex-1 p-6 max-w-3xl w-full mx-auto">
              <button
                onClick={() => setSelected(null)}
                className="md:hidden text-blue-600 hover:text-blue-700 text-sm mb-4 flex items-center gap-1 font-medium"
              >
                ← Back
              </button>

              {/* Email header */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4 shadow-sm">
                <h2 className="text-slate-900 text-xl font-bold mb-3">{selected.subject || '(no subject)'}</h2>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {getInitials(selected.from_name || selected.from_email)}
                  </div>
                  <div>
                    <p className="text-slate-900 text-sm font-semibold">{selected.from_name || selected.from_email}</p>
                    <p className="text-slate-400 text-xs">{selected.from_email} · {timeAgo(selected.received_at)}</p>
                  </div>
                </div>
              </div>

              {/* Email body */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">{selected.body_text || 'No content'}</p>
              </div>

              {/* Reply button */}
              <div className="mt-5">
                <button
                  onClick={() => router.push(`/inbox/${selected.gmail_id}/reply`)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors shadow flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                  Generate AI Reply
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 hidden md:flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-slate-500 text-sm font-medium">Select an email to read</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
