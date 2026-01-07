-- Habilitar RLS na tabela projects (caso ainda não esteja habilitada)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Remover a política existente
DROP POLICY IF EXISTS "Project authors and admins can delete projects" ON projects;

-- Política para permitir deleção de projetos apenas pelo autor ou admin
CREATE POLICY "Project authors and admins can delete projects"
ON projects FOR DELETE
TO authenticated
USING (
  -- Permite que o autor do projeto exclua
  created_by = auth.uid() 
  OR 
  -- Permite que admins excluam qualquer projeto
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
); 