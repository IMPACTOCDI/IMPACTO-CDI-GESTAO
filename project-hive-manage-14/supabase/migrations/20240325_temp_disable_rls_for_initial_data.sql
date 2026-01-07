-- Temporariamente desabilitar RLS para inserir dados iniciais
ALTER TABLE authorized_emails DISABLE ROW LEVEL SECURITY;

-- Inserir emails autorizados iniciais
INSERT INTO authorized_emails (email, role) VALUES 
  ('admin@imibrasil.com.br', 'admin'),
  ('manager@imibrasil.com.br', 'manager'),
  ('user@imibrasil.com.br', 'member'),
  ('test@imibrasil.com.br', 'member')
ON CONFLICT (email) DO NOTHING;

-- Reabilitar RLS
ALTER TABLE authorized_emails ENABLE ROW LEVEL SECURITY;

-- Verificar se os dados foram inseridos
-- SELECT * FROM authorized_emails;