import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createClient } from '@/lib/supabase/server'

function decodeBody(data: string) {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
}

function extractBody(payload: any): { text: string; html: string } {
  let text = ''
  let html = ''

  if (!payload) return { text, html }

  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    text = decodeBody(payload.body.data)
  } else if (payload.mimeType === 'text/html' && payload.body?.data) {
    html = decodeBody(payload.body.data)
  } else if (payload.parts) {
    for (const part of payload.parts) {
      const nested = extractBody(part)
      if (nested.text) text = nested.text
      if (nested.html) html = nested.html
    }
  }

  return { text, html }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const oauth2Client = new google.auth.OAuth2()
    oauth2Client.setCredentials({ access_token: session.provider_token })

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

    // Fetch 50 unread emails from primary inbox
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread category:primary',
      maxResults: 50,
    })

    const messages = listRes.data.messages || []

    if (messages.length === 0) {
      return NextResponse.json({ emails: [] })
    }

    // Fetch full details for each message
    const emailDetails = await Promise.all(
      messages.map(async (msg) => {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'full',
        })

        const headers = detail.data.payload?.headers || []
        const get = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || ''

        const from = get('From')
        const fromMatch = from.match(/^(.*?)\s*<(.+)>$/)
        const fromName = fromMatch ? fromMatch[1].replace(/"/g, '').trim() : from
        const fromEmail = fromMatch ? fromMatch[2] : from

        const { text, html } = extractBody(detail.data.payload)

        return {
          gmail_id: msg.id!,
          thread_id: detail.data.threadId || '',
          from_email: fromEmail,
          from_name: fromName,
          subject: get('Subject'),
          body_text: text,
          body_html: html,
          received_at: new Date(parseInt(detail.data.internalDate || '0')).toISOString(),
          is_replied: false,
        }
      })
    )

    // Upsert into Supabase (skip duplicates)
    const { error } = await supabase
      .from('emails')
      .upsert(emailDetails, { onConflict: 'gmail_id', ignoreDuplicates: true })

    if (error) {
      console.error('Supabase upsert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ emails: emailDetails, count: emailDetails.length })
  } catch (err: any) {
    console.error('Gmail API error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
