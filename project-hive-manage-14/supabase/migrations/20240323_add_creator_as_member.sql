-- Função para adicionar o criador do projeto como membro
CREATE OR REPLACE FUNCTION add_creator_as_member()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO project_members (project_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'owner');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para adicionar o criador como membro
DROP TRIGGER IF EXISTS add_creator_as_member_trigger ON projects;
CREATE TRIGGER add_creator_as_member_trigger
    AFTER INSERT ON projects
    FOR EACH ROW
    EXECUTE FUNCTION add_creator_as_member();

-- Adicionar criadores existentes como membros
INSERT INTO project_members (project_id, user_id, role)
SELECT id, created_by, 'owner'
FROM projects
WHERE NOT EXISTS (
    SELECT 1 FROM project_members
    WHERE project_members.project_id = projects.id
    AND project_members.user_id = projects.created_by
); 