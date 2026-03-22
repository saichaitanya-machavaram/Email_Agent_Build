-- Enable pgvector extension
create extension if not exists vector;

-- ─── Emails Table ────────────────────────────────────────────
create table if not exists emails (
  id uuid primary key default gen_random_uuid(),
  gmail_id text unique not null,
  thread_id text,
  from_email text not null,
  from_name text,
  subject text,
  body_text text,
  body_html text,
  received_at timestamptz,
  is_replied boolean default false,
  created_at timestamptz default now()
);

-- ─── Replies Table ───────────────────────────────────────────
create table if not exists replies (
  id uuid primary key default gen_random_uuid(),
  email_id uuid references emails(id) on delete cascade,
  ai_draft text not null,
  sent_reply text,
  was_edited boolean default false,
  sent_at timestamptz,
  created_at timestamptz default now()
);

-- ─── Feedback Table ──────────────────────────────────────────
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  reply_id uuid references replies(id) on delete cascade,
  star_rating integer check (star_rating between 1 and 5),
  feedback_text text,
  created_at timestamptz default now()
);

-- ─── Knowledge Base Table (pgvector) ─────────────────────────
create table if not exists knowledge_base (
  id uuid primary key default gen_random_uuid(),
  course_name text,
  content text not null,
  embedding vector(1536),
  metadata jsonb,
  created_at timestamptz default now()
);

-- Index for fast similarity search
create index if not exists knowledge_base_embedding_idx
  on knowledge_base
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- ─── RLS Policies ────────────────────────────────────────────
alter table emails enable row level security;
alter table replies enable row level security;
alter table feedback enable row level security;
alter table knowledge_base enable row level security;

-- Allow authenticated users to read/write all tables
create policy "authenticated access" on emails
  for all using (auth.role() = 'authenticated');

create policy "authenticated access" on replies
  for all using (auth.role() = 'authenticated');

create policy "authenticated access" on feedback
  for all using (auth.role() = 'authenticated');

create policy "authenticated access" on knowledge_base
  for all using (auth.role() = 'authenticated');

-- ─── Match documents function for RAG ────────────────────────
create or replace function match_documents(
  query_embedding vector(1536),
  match_count int default 5
)
returns table (
  id uuid,
  course_name text,
  content text,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    id,
    course_name,
    content,
    metadata,
    1 - (embedding <=> query_embedding) as similarity
  from knowledge_base
  order by embedding <=> query_embedding
  limit match_count;
$$;
