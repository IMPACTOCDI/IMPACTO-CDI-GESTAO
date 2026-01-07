-- Adiciona autoria, edição e suporte a exclusão em messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS user_id uuid references auth.users(id);
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_edited boolean DEFAULT false;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Permitir update/delete apenas pelo autor
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir update de qualquer usuário" ON messages;
DROP POLICY IF EXISTS "Permitir delete de qualquer usuário" ON messages;
CREATE POLICY "Permitir update apenas pelo autor" ON messages FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Permitir delete apenas pelo autor" ON messages FOR DELETE USING (user_id = auth.uid()); 