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

export default function ReplyPage() {
  const { gmailId } = useParams<{ gmailId: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState<Email | null>(null)
  const [aiDraft, setAiDraft] = useState('')
  const [replyId, setReplyId] = useState<string | null>(null)
  const [editedReply, setEditedReply] = useState('')
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchEmail = async () => {
      const { data } = await supabase
        .from('emails')
        .select('*')
        .eq('gmail_id', gmailId)
        .single()
      if (data) {
        setEmail(data)
        generateReply(data)
      }
    }
    fetchEmail()
  }, [gmailId])

  const generateReply = async (emailData: Email) => {
    setGenerating(true)
    setError('')
    try {
      const res = await fetch('/api/ai/generate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gmailId }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setAiDraft(data.aiDraft)
        setEditedReply(data.aiDraft)
        setReplyId(data.replyId)
      }
    } catch (err: any) {
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
          threadId: email.gmail_id,
        }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setSent(true)
        setTimeout(() => router.push('/inbox'), 2000)
      }
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-white text-xl font-semibold mb-2">Email sent!</h2>
          <p className="text-gray-400 text-sm">Redirecting to inbox...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push('/inbox')} className="text-gray-400 hover:text-white transition-colors">
          ← Back
        </button>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">E</div>
          <span className="text-white font-semibold">Email Agent</span>
        </div>
      </header>

      <div className="flex-1 max-w-4xl w-full mx-auto p-6 flex flex-col gap-6">
        {/* Original email */}
        {email && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-gray-500 text-xs uppercase tracking-wide font-medium">Original Email</span>
            </div>
            <h2 className="text-white font-semibold mb-2">{email.subject || '(no subject)'}</h2>
            <p className="text-gray-400 text-sm mb-3">From: {email.from_name || email.from_email} &lt;{email.from_email}&gt;</p>
            <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed line-clamp-6">{email.body_text}</p>
          </div>
        )}

        {/* AI Draft */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-500 text-xs uppercase tracking-wide font-medium">AI Draft Reply</span>
            {aiDraft && !generating && (
              <button
                onClick={() => email && generateReply(email)}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                ↺ Regenerate
              </button>
            )}
          </div>

          {generating ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-400 text-sm">Searching knowledge base & generating reply...</p>
            </div>
          ) : error ? (
            <div className="text-red-400 text-sm p-4 bg-red-900/20 rounded-lg">{error}</div>
          ) : (
            <textarea
              value={editedReply}
              onChange={(e) => setEditedReply(e.target.value)}
              className="flex-1 w-full bg-gray-800 text-gray-200 text-sm rounded-lg p-4 border border-gray-700 focus:border-blue-500 focus:outline-none resize-none leading-relaxed min-h-64"
              placeholder="AI reply will appear here..."
              rows={16}
            />
          )}

          {aiDraft && editedReply !== aiDraft && (
            <p className="text-yellow-500 text-xs mt-2">✏️ You&apos;ve edited this reply</p>
          )}
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {/* Send button */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/inbox')}
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={!editedReply || generating || sending}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-8 py-3 rounded-xl transition-colors flex items-center gap-2"
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
      </div>
    </div>
  )
}
