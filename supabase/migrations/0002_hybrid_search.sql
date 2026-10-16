-- Spec change: also returns vector_rank and text_rank so the relevance gate
-- can check "full-text hit in the top 5" without a second query.
create or replace function hybrid_search(
  query_text text,
  query_embedding vector(768),
  match_count int default 20,
  authorities text[] default null,
  include_superseded boolean default false
)
returns table (
  chunk_id uuid,
  document_id uuid,
  clause_ref text,
  content text,
  page_start int,
  rrf_score float,
  similarity float,
  vector_rank int,
  text_rank int
)
language sql stable
as $$
  with eligible as (
    select c.id
    from chunks c
    join documents d on d.id = c.document_id
    where (authorities is null or d.authority = any(authorities))
      and (include_superseded or d.status = 'current')
  ),
  vec as (
    select c.id,
           1 - (c.embedding <=> query_embedding) as sim,
           row_number() over (order by c.embedding <=> query_embedding)::int as rnk
    from chunks c
    join eligible e on e.id = c.id
    where c.embedding is not null
    order by c.embedding <=> query_embedding
    limit 50
  ),
  fts as (
    select c.id,
           row_number() over (order by ts_rank_cd(c.fts, q.q) desc)::int as rnk
    from chunks c
    join eligible e on e.id = c.id
    cross join (select websearch_to_tsquery('english', query_text) as q) q
    where c.fts @@ q.q
    order by ts_rank_cd(c.fts, q.q) desc
    limit 50
  ),
  fused as (
    select coalesce(v.id, f.id) as id,
           coalesce(1.0 / (60 + v.rnk), 0) + coalesce(1.0 / (60 + f.rnk), 0) as score,
           v.sim,
           v.rnk as vrank,
           f.rnk as trank
    from vec v
    full join fts f on f.id = v.id
  )
  select c.id, c.document_id, c.clause_ref, c.content, c.page_start,
         fu.score::float, fu.sim::float, fu.vrank, fu.trank
  from fused fu
  join chunks c on c.id = fu.id
  order by fu.score desc
  limit match_count;
$$;
