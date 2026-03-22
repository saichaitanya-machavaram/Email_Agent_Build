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
      if (data.error) {
        console.error(data.error)
      } else {
        await fetchFromDB()
      }
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
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">E</div>
          <span className="text-white font-semibold text-lg">Email Agent</span>
          {emails.length > 0 && (
            <span className="bg-blue-600 text-white text-xs font-medium px-2 py-0.5 rounded-full">{emails.length}</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm hidden sm:block">{userEmail}</span>
          <button
            onClick={syncGmail}
            disabled={syncing}
            className="text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {syncing ? 'Syncing...' : 'Sync'}
          </button>
          <button onClick={handleSignOut} className="text-sm text-gray-400 hover:text-white transition-colors">
            Sign out
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Email list */}
        <div className={`${selected ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-96 border-r border-gray-800 overflow-y-auto`}>
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-gray-400 text-sm">Loading emails...</p>
              </div>
            </div>
          ) : emails.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center px-6">
                <div className="text-4xl mb-3">📭</div>
                <p className="text-white font-medium">No unread emails</p>
                <p className="text-gray-500 text-sm mt-1">Your primary inbox is all caught up</p>
              </div>
            </div>
          ) : (
            emails.map((email) => (
              <button
                key={email.gmail_id}
                onClick={() => setSelected(email)}
                className={`text-left px-4 py-4 border-b border-gray-800/60 hover:bg-gray-900 transition-colors ${selected?.gmail_id === email.gmail_id ? 'bg-gray-900 border-l-2 border-l-blue-600' : ''}`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-white text-sm font-medium truncate">{email.from_name || email.from_email}</span>
                  <span className="text-gray-500 text-xs shrink-0">{timeAgo(email.received_at)}</span>
                </div>
                <p className="text-gray-300 text-sm truncate mb-1">{email.subject || '(no subject)'}</p>
                <p className="text-gray-500 text-xs truncate">{email.body_text?.slice(0, 100)}</p>
              </button>
            ))
          )}
        </div>

        {/* Email detail */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          {selected ? (
            <div className="flex-1 p-6 max-w-3xl w-full mx-auto">
              <button
                onClick={() => setSelected(null)}
                className="md:hidden text-gray-400 hover:text-white text-sm mb-4 flex items-center gap-1"
              >
                ← Back
              </button>
              <div className="mb-6">
                <h2 className="text-white text-xl font-semibold mb-3">{selected.subject || '(no subject)'}</h2>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                    {(selected.from_name || selected.from_email)[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{selected.from_name || selected.from_email}</p>
                    <p className="text-gray-400 text-xs">{selected.from_email} · {timeAgo(selected.received_at)}</p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-900 rounded-xl p-5 text-gray-300 text-sm leading-relaxed whitespace-pre-wrap border border-gray-800">
                {selected.body_text || 'No content'}
              </div>
              <div className="mt-6">
                <button
                  onClick={() => router.push(`/inbox/${selected.gmail_id}/reply`)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-xl transition-colors flex items-center gap-2"
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
                <div className="text-4xl mb-3">✉️</div>
                <p className="text-gray-400 text-sm">Select an email to read</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
