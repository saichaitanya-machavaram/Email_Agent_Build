-- Add embedding column to replies table
alter table replies add column if not exists embedding vector(1536);

-- Index for fast similarity search on replies
create index if not exists replies_embedding_idx
  on replies
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 50);

-- Match similar past replies with their feedback
create or replace function match_replies(
  query_embedding vector(1536),
  match_count int default 3,
  min_rating int default 1
)
returns table (
  id uuid,
  sent_reply text,
  star_rating int,
  feedback_text text,
  similarity float
)
language sql stable
as $$
  select
    r.id,
    r.sent_reply,
    f.star_rating,
    f.feedback_text,
    1 - (r.embedding <=> query_embedding) as similarity
  from replies r
  left join feedback f on f.reply_id = r.id
  where r.sent_reply is not null
    and r.embedding is not null
    and (f.star_rating is null or f.star_rating >= min_rating)
  order by r.embedding <=> query_embedding
  limit match_count;
$$;
