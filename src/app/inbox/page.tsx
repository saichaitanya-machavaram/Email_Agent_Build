import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function InboxPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-white text-2xl font-semibold mb-2">Inbox</h1>
        <p className="text-gray-400">Logged in as {user.email}</p>
        <p className="text-gray-600 text-sm mt-4">Gmail integration coming in Phase 2</p>
      </div>
    </div>
  )
}
