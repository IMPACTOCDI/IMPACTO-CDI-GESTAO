-- Habilitar RLS na tabela calendar_events
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- Política para permitir leitura de eventos para usuários autenticados
CREATE POLICY "Calendar events are viewable by authenticated users"
ON calendar_events FOR SELECT
TO authenticated
USING (true);

-- Política para permitir inserção de eventos para usuários autenticados
CREATE POLICY "Users can insert their own calendar events"
ON calendar_events FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

-- Política para permitir atualização de eventos pelo criador
CREATE POLICY "Users can update their own calendar events"
ON calendar_events FOR UPDATE
TO authenticated
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

-- Política para permitir deleção de eventos pelo criador
CREATE POLICY "Users can delete their own calendar events"
ON calendar_events FOR DELETE
TO authenticated
USING (auth.uid() = created_by); 