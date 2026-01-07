-- Inserir emails autorizados iniciais na tabela authorized_emails
-- Isso resolve o problema de "Email não autorizado" durante o registro

-- Inserir emails de exemplo (substitua pelos emails reais da sua organização)
INSERT INTO authorized_emails (email, role) VALUES 
  ('admin@imibrasil.com.br', 'admin'),
  ('manager@imibrasil.com.br', 'manager'),
  ('user@imibrasil.com.br', 'member'),
  ('test@imibrasil.com.br', 'member')
ON CONFLICT (email) DO NOTHING;

-- Verificar se os emails foram inseridos
-- SELECT * FROM authorized_emails;