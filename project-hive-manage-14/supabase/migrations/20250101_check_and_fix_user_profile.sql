-- Verificar e corrigir perfil do usuário
-- Execute este arquivo no SQL Editor do Supabase

-- 1. Verificar se o perfil existe
SELECT * FROM profiles WHERE id = '50a3ec33-87b7-4ee0-9250-e21f394c4d4e';

-- 2. Se o perfil não existir, criar manualmente
INSERT INTO profiles (
    id,
    name,
    email,
    role,
    status,
    created_at,
    updated_at
) VALUES (
    '50a3ec33-87b7-4ee0-9250-e21f394c4d4e',
    'Aryan Martins',  -- Ajuste o nome se necessário
    'aryanmartins@gmail.com',
    'admin',
    'active',
    NOW(),
    NOW()
)
ON CONFLICT (id) DO UPDATE SET
    status = 'active',
    updated_at = NOW();

-- 3. Verificar se o email está autorizado
SELECT * FROM authorized_emails WHERE email = 'aryanmartins@gmail.com';

-- 4. Se não estiver autorizado, autorizar
INSERT INTO authorized_emails (email, role) VALUES 
  ('aryanmartins@gmail.com', 'admin')
ON CONFLICT (email) DO UPDATE SET role = 'admin';

-- 5. Confirmar o email do usuário manualmente (via SQL)
-- NOTA: Isso só funciona se você tiver acesso ao service_role key
-- UPDATE auth.users 
-- SET email_confirmed_at = NOW()
-- WHERE id = '50a3ec33-87b7-4ee0-9250-e21f394c4d4e';
