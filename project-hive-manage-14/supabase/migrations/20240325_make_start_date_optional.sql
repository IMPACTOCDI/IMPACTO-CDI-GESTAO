-- Remover a constraint NOT NULL da coluna start_date na tabela projects
-- Isso permite que projetos sejam criados e editados sem data de início obrigatória

ALTER TABLE projects 
ALTER COLUMN start_date DROP NOT NULL;