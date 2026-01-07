-- Adiciona campo para identificar conversas de grupo
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT FALSE; 