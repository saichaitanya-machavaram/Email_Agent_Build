import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { emailId, gmailId } = await request.json()

    // Fetch the email
    const { data: email, error: emailError } = await supabase
      .from('emails')
      .select('*')
      .eq('gmail_id', gmailId)
      .single()

    if (emailError || !email) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 })
    }

    // Embed the email for RAG
    const emailText = `${email.subject}\n\n${email.body_text}`
    const embeddingRes = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: emailText.slice(0, 8000),
    })
    const queryEmbedding = embeddingRes.data[0].embedding

    // RAG: fetch top 5 relevant courses
    const admin = createAdminClient()
    const { data: docs, error: ragError } = await admin.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_count: 5,
    })

    const context = docs && docs.length > 0
      ? docs.map((d: any) => d.content).join('\n\n---\n\n')
      : 'No specific course information found.'

    // Generate reply with GPT-4o
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a helpful email assistant for Vizaura, an online education platform.
You help respond to inquiries about courses and programs.
Use the provided course information to craft accurate, helpful, and friendly email replies.
Always be professional, concise, and specific. Include relevant course details like price, dates, and mode of delivery when applicable.
Sign off as "The Vizaura Team".`,
        },
        {
          role: 'user',
          content: `Incoming email from ${email.from_name || email.from_email}:

Subject: ${email.subject}

${email.body_text}

---

Relevant course information from our knowledge base:
${context}

---

Please write a professional email reply addressing their inquiry. Use the course information above where relevant.`,
        },
      ],
      temperature: 0.7,
    })

    const aiDraft = completion.choices[0].message.content || ''

    // Save draft to Supabase
    const { data: reply, error: replyError } = await supabase
      .from('replies')
      .insert({
        email_id: email.id,
        ai_draft: aiDraft,
      })
      .select()
      .single()

    if (replyError) {
      return NextResponse.json({ error: replyError.message }, { status: 500 })
    }

    return NextResponse.json({ aiDraft, replyId: reply.id })
  } catch (err: any) {
    console.error('Generate reply error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
