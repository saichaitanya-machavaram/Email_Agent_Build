'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Email {
  id: string
  gmail_id: string
  from_name: string
  from_email: string
  subject: string
  body_text: string
  received_at: string
}

type Step = { label: string; status: 'pending' | 'active' | 'done' | 'error' }

const STEPS: Step[] = [
  { label: 'Fetching email details', status: 'pending' },
  { label: 'Embedding email for search', status: 'pending' },
  { label: 'Searching knowledge base', status: 'pending' },
  { label: 'Generating AI reply', status: 'pending' },
]

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/```[\s\S]*?```/g, '').replace(/`([^`]+)`/g, '$1')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1 ($2)')
    .replace(/^[-*+]\s+/gm, '• ')
    .replace(/^\d+\.\s+/gm, (m) => m)
    .trim()
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

export default function ReplyPage() {
  const { gmailId } = useParams<{ gmailId: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState<Email | null>(null)
  const [aiDraft, setAiDraft] = useState('')
  const [replyId, setReplyId] = useState<string | null>(null)
  const [editedReply, setEditedReply] = useState('')
  const [steps, setSteps] = useState<Step[]>(STEPS.map(s => ({ ...s })))
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const setStepStatus = (index: number, status: Step['status']) => {
    setSteps(prev => prev.map((s, i) => i === index ? { ...s, status } : s))
  }

  useEffect(() => {
    const fetchEmail = async () => {
      const { data } = await supabase
        .from('emails')
        .select('*')
        .eq('gmail_id', gmailId)
        .single()
      if (data) {
        setEmail(data)
        generateReply()
      }
    }
    fetchEmail()
  }, [gmailId])

  const generateReply = async () => {
    setGenerating(true)
    setError('')
    setAiDraft('')
    setEditedReply('')
    const freshSteps = STEPS.map(s => ({ ...s }))
    setSteps(freshSteps)

    // Step 0
    setStepStatus(0, 'active')
    await new Promise(r => setTimeout(r, 400))
    setStepStatus(0, 'done')

    // Step 1
    setStepStatus(1, 'active')
    await new Promise(r => setTimeout(r, 300))

    try {
      // Steps 2 & 3 happen server-side — we animate them with a slight delay
      const fetchPromise = fetch('/api/ai/generate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gmailId }),
      })

      // Animate steps 1→2→3 while waiting
      await new Promise(r => setTimeout(r, 600))
      setStepStatus(1, 'done')
      setStepStatus(2, 'active')
      await new Promise(r => setTimeout(r, 800))
      setStepStatus(2, 'done')
      setStepStatus(3, 'active')

      const res = await fetchPromise
      const data = await res.json()

      if (data.error) {
        setStepStatus(3, 'error')
        setError(data.error)
      } else {
        setStepStatus(3, 'done')
        const clean = stripMarkdown(data.aiDraft)
        setAiDraft(clean)
        setEditedReply(clean)
        setReplyId(data.replyId)
      }
    } catch (err: any) {
      setStepStatus(3, 'error')
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  const handleSend = async () => {
    if (!replyId || !email) return
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gmailId,
          replyId,
          to: email.from_email,
          subject: email.subject,
          body: editedReply,
        }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setSent(true)
      }
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="bg-white border border-slate-200 rounded-2xl shadow p-10 text-center max-w-sm w-full">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-slate-900 text-xl font-bold mb-1">Reply sent!</h2>
          <p className="text-slate-400 text-sm mb-6">Your email has been delivered successfully.</p>
          <button
            onClick={() => router.push('/inbox')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors w-full"
          >
            Back to Inbox
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-4 shadow-sm">
        <button onClick={() => router.push('/inbox')} className="text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors">
          ← Inbox
        </button>
        <div className="h-4 w-px bg-slate-200" />
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xs">E</div>
          <span className="text-slate-900 font-bold">Email Agent</span>
        </div>
      </header>

      <div className="flex-1 max-w-4xl w-full mx-auto p-6 flex flex-col gap-5">

        {/* Original email */}
        {email && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
              <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Original Email</span>
            </div>
            <div className="p-5">
              <h2 className="text-slate-900 font-bold text-lg mb-3">{email.subject || '(no subject)'}</h2>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                  {getInitials(email.from_name || email.from_email)}
                </div>
                <div>
                  <p className="text-slate-800 text-sm font-semibold">{email.from_name || email.from_email}</p>
                  <p className="text-slate-400 text-xs">{email.from_email}</p>
                </div>
              </div>
              <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{email.body_text}</p>
            </div>
          </div>
        )}

        {/* Processing steps */}
        {generating && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-4">Processing</p>
            <div className="flex flex-col gap-3">
              {steps.map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                    step.status === 'done' ? 'bg-green-100' :
                    step.status === 'active' ? 'bg-blue-100' :
                    step.status === 'error' ? 'bg-red-100' :
                    'bg-slate-100'
                  }`}>
                    {step.status === 'done' && (
                      <svg className="w-3 h-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {step.status === 'active' && (
                      <div className="w-2.5 h-2.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    )}
                    {step.status === 'error' && (
                      <svg className="w-3 h-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    {step.status === 'pending' && (
                      <div className="w-2 h-2 rounded-full bg-slate-300" />
                    )}
                  </div>
                  <span className={`text-sm ${
                    step.status === 'active' ? 'text-blue-600 font-medium' :
                    step.status === 'done' ? 'text-slate-700' :
                    step.status === 'error' ? 'text-red-500' :
                    'text-slate-400'
                  }`}>{step.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Draft */}
        {!generating && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">AI Draft Reply</span>
              {aiDraft && (
                <button
                  onClick={generateReply}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors flex items-center gap-1"
                >
                  ↺ Regenerate
                </button>
              )}
            </div>
            <div className="p-5">
              {error ? (
                <div className="text-red-600 text-sm p-4 bg-red-50 border border-red-200 rounded-lg">{error}</div>
              ) : (
                <>
                  <textarea
                    value={editedReply}
                    onChange={(e) => setEditedReply(e.target.value)}
                    className="w-full bg-slate-50 text-slate-800 text-sm rounded-lg p-4 border border-slate-200 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none leading-relaxed min-h-64 font-mono"
                    placeholder="AI reply will appear here..."
                    rows={16}
                  />
                  {aiDraft && editedReply !== aiDraft && (
                    <p className="text-amber-600 text-xs mt-2 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Draft edited
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        {!generating && (
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/inbox')}
              className="text-slate-400 hover:text-slate-700 text-sm transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={!editedReply || sending}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-8 py-3 rounded-xl transition-colors shadow flex items-center gap-2"
            >
              {sending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Approve & Send
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
