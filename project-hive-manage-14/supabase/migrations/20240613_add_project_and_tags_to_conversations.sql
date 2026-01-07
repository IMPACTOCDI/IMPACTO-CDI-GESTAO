-- Adiciona campo de projeto e tags na tabela de conversas do WhatsApp
alter table public.conversations add column if not exists project text;
alter table public.conversations add column if not exists tags text[];
 
-- Index para busca por projeto
create index if not exists idx_conversations_project on public.conversations(project); 