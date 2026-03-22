import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createClient } from '@/lib/supabase/server'

function makeRawEmail({
  to,
  subject,
  body,
  replyToMessageId,
  threadId,
}: {
  to: string
  subject: string
  body: string
  replyToMessageId?: string
  threadId?: string
}) {
  const subjectLine = subject.startsWith('Re:') ? subject : `Re: ${subject}`
  const lines = [
    `To: ${to}`,
    `Subject: ${subjectLine}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    ...(replyToMessageId ? [`In-Reply-To: ${replyToMessageId}`, `References: ${replyToMessageId}`] : []),
    '',
    body,
  ]
  return Buffer.from(lines.join('\r\n'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { gmailId, replyId, to, subject, body } = await request.json()

    // Fetch thread id from DB
    const { data: emailRecord } = await supabase
      .from('emails')
      .select('id, thread_id, ai_draft:replies(ai_draft)')
      .eq('gmail_id', gmailId)
      .single()

    const oauth2Client = new google.auth.OAuth2()
    oauth2Client.setCredentials({ access_token: session.provider_token })

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

    // Fetch the original message to get Message-ID header for threading
    const originalMsg = await gmail.users.messages.get({
      userId: 'me',
      id: gmailId,
      format: 'metadata',
      metadataHeaders: ['Message-ID'],
    })

    const messageId = originalMsg.data.payload?.headers
      ?.find(h => h.name === 'Message-ID')?.value

    const raw = makeRawEmail({
      to,
      subject,
      body,
      replyToMessageId: messageId ?? undefined,
    })

    // Send via Gmail API
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw,
        threadId: emailRecord?.thread_id ?? undefined,
      },
    })

    // Fetch the ai_draft to check if reply was edited
    const { data: replyRecord } = await supabase
      .from('replies')
      .select('ai_draft')
      .eq('id', replyId)
      .single()

    const wasEdited = replyRecord?.ai_draft !== body

    // Update reply record with sent content
    await supabase
      .from('replies')
      .update({
        sent_reply: body,
        was_edited: wasEdited,
        sent_at: new Date().toISOString(),
      })
      .eq('id', replyId)

    // Mark email as replied
    await supabase
      .from('emails')
      .update({ is_replied: true })
      .eq('gmail_id', gmailId)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Send email error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
