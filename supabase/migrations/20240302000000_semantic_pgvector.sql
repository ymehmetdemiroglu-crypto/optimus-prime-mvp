-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector
with schema extensions;

-- Add embedding column to search_terms table (1536 dims for OpenAI embeddings)
alter table public.search_terms
add column if not exists embedding vector(1536);

-- Create an index for faster similarity searches (Cosine distance)
create index if not exists search_terms_embedding_idx 
on public.search_terms 
using hnsw (embedding vector_cosine_ops);
