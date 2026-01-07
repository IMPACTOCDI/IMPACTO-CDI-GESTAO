-- Adicionar coluna created_by à tabela tasks
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id);

-- Atualizar registros existentes com o ID do usuário autenticado
UPDATE tasks
SET created_by = (
    SELECT created_by 
    FROM projects 
    WHERE projects.id = tasks.project_id
)
WHERE created_by IS NULL;

-- Verificar se ainda existem registros nulos
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM tasks WHERE created_by IS NULL) THEN
        RAISE EXCEPTION 'Existem tarefas sem created_by definido';
    END IF;
END $$;

-- Tornar a coluna NOT NULL após atualizar os registros existentes
ALTER TABLE tasks
ALTER COLUMN created_by SET NOT NULL; 