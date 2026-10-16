create extension if not exists vector;

create table documents (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  authority text not null check (authority in ('DM','Trakhees','RERA','Other')),
  edition text not null,
  published_on date,
  status text not null default 'current' check (status in ('current','superseded')),
  source_url text,
  storage_path text,
  language text not null default 'en',
  created_at timestamptz default now()
);

-- array_to_string is only STABLE, so a generated column cannot call it directly.
-- Wrapping it as IMMUTABLE is safe here: the output depends only on the inputs.
create or replace function chunk_fts_doc(clause_ref text, heading_path text[], content text)
returns tsvector
language sql immutable
as $$
  select to_tsvector('english',
    coalesce(clause_ref, '') || ' ' || coalesce(array_to_string(heading_path, ' '), '') || ' ' || coalesce(content, ''))
$$;

create table chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  clause_ref text not null,
  heading_path text[] not null default '{}',
  part text,
  page_start int not null,
  page_end int not null,
  content text not null,
  content_type text not null check (content_type in ('clause','table','definition')),
  token_count int,
  content_hash text not null,
  embedding vector(768),
  fts tsvector generated always as (chunk_fts_doc(clause_ref, heading_path, content)) stored,
  unique (document_id, clause_ref, page_start)
);
create index chunks_embedding_idx on chunks using hnsw (embedding vector_cosine_ops);
create index chunks_fts_idx on chunks using gin (fts);
create index chunks_document_idx on chunks (document_id);

create table query_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  question text not null,
  authority_filter text[],
  rewritten_query text,
  retrieved jsonb,
  answer jsonb,
  abstained boolean,
  abstain_reason text,
  verify_passed boolean,
  latency_ms int,
  model text,
  ip_hash text
);

create table feedback (
  id uuid primary key default gen_random_uuid(),
  query_log_id uuid references query_logs(id),
  rating smallint check (rating in (-1, 1)),
  comment text,
  correct_clause text,
  created_at timestamptz default now()
);

create table rate_limits (
  key text,
  window_start timestamptz,
  count int,
  primary key (key, window_start)
);

create table eval_runs (
  id uuid primary key default gen_random_uuid(),
  git_sha text,
  tag text,
  config jsonb,
  metrics jsonb,
  created_at timestamptz default now()
);

create table eval_results (
  run_id uuid references eval_runs(id),
  question_id text,
  retrieved jsonb,
  answer jsonb,
  scores jsonb,
  primary key (run_id, question_id)
);

-- Records the embedding model so a query-time mismatch is detectable (spec 7.3).
create table app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

alter table documents enable row level security;
alter table chunks enable row level security;
alter table query_logs enable row level security;
alter table feedback enable row level security;
alter table rate_limits enable row level security;
alter table eval_runs enable row level security;
alter table eval_results enable row level security;
alter table app_config enable row level security;
