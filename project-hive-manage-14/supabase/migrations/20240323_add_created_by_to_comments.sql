-- Adicionar coluna created_by à tabela comments
ALTER TABLE comments ADD COLUMN created_by UUID REFERENCES profiles(id);

-- Atualizar registros existentes
UPDATE comments
SET created_by = (
    SELECT created_by
    FROM tasks
    WHERE tasks.id = comments.task_id
);

-- Tornar a coluna NOT NULL após atualizar os registros existentes
ALTER TABLE comments ALTER COLUMN created_by SET NOT NULL; 