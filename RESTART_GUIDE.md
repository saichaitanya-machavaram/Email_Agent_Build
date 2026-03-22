# Restart Guide — Email Agent

## Steps to Restart the App

### 1. Restore Supabase (~2 minutes)
1. Go to https://supabase.com → sign in
2. Open project `email-agent` (btxrqsmfcothdntccjyh)
3. If paused: Settings → General → click **Restore project**
4. Wait ~2 minutes for it to come back online
5. Run this in SQL Editor to ensure pgvector is active:
   ```sql
   create extension if not exists vector;
   ```

### 2. Vercel — nothing to do
- App is always live at https://email-agent-vizaura.vercel.app
- No action needed

### 3. OpenAI — nothing to do
- Pay per use, no subscription running

### 4. Test the app
- Open https://email-agent-vizaura.vercel.app
- Sign in with Google (saichaitanya.machavaram@gmail.com)
- Click Sync to load emails
- Try generating a reply

---

## If Something Breaks After Restore

### RAG / vector search not working
```sql
create extension if not exists vector;
```
Run in Supabase → SQL Editor.

### Tables missing
Re-run `supabase/schema.sql` in Supabase → SQL Editor.

### Reply embedding column missing
Re-run `supabase/add_reply_embeddings.sql` in Supabase → SQL Editor.

### Auth not working
- Check Supabase → Authentication → Providers → Google is still enabled
- Check Client ID and Secret are still saved

### Gmail not syncing
- Sign out and sign back in — the OAuth token may have expired

---

## Local Development Restart

```bash
cd C:\Users\chait\Desktop\Email_Agent
npm run dev
```
Then open http://localhost:3000

### Re-seed knowledge base (only if knowledge_base table is empty)
```bash
npx ts-node --transpile-only --skip-project --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' scripts/seed-knowledge-base.ts
```

---

## Key URLs
| Resource | URL |
|---|---|
| Live app | https://email-agent-vizaura.vercel.app |
| Supabase dashboard | https://supabase.com/dashboard/project/btxrqsmfcothdntccjyh |
| Vercel dashboard | https://vercel.com/saichaitanya-machavarams-projects/email-agent-vizaura |
| Google Cloud Console | https://console.cloud.google.com (project: email-agent) |
| GitHub repo | https://github.com/saichaitanya-machavaram/Email_Agent_Build |
