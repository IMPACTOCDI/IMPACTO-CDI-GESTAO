-- Autorizar email do desenvolvedor
-- Execute este arquivo no SQL Editor do Supabase

INSERT INTO authorized_emails (email, role) VALUES 
  ('aryanmartins@gmail.com', 'admin')
ON CONFLICT (email) DO UPDATE SET role = 'admin';

-- Verificar se o email foi autorizado
SELECT * FROM authorized_emails WHERE email = 'aryanmartins@gmail.com';
