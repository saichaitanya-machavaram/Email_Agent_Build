import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { replyId, starRating, feedbackText } = await request.json()

    if (!replyId || !starRating || starRating < 1 || starRating > 5) {
      return NextResponse.json({ error: 'Invalid feedback data' }, { status: 400 })
    }

    const { error } = await supabase.from('feedback').insert({
      reply_id: replyId,
      star_rating: starRating,
      feedback_text: feedbackText || null,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
