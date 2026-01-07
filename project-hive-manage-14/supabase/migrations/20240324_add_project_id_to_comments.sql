-- Adicionar coluna project_id à tabela comments
ALTER TABLE comments ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);

-- Atualizar os valores existentes da coluna project_id baseado na tarefa associada
UPDATE comments
SET project_id = tasks.project_id
FROM tasks
WHERE comments.task_id = tasks.id;

-- Tornar a coluna NOT NULL após preencher os valores
ALTER TABLE comments ALTER COLUMN project_id SET NOT NULL;

-- Adicionar índice para melhorar performance
CREATE INDEX IF NOT EXISTS comments_project_id_idx ON comments(project_id);