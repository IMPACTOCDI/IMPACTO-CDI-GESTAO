-- Criar tabela de backups
CREATE TABLE IF NOT EXISTS backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  size BIGINT,
  status TEXT NOT NULL DEFAULT 'pending',
  metadata JSONB
);

-- Criar tabela de logs de requisições
CREATE TABLE IF NOT EXISTS request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB
);

-- Criar tabela de roles de usuário
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Remover todas as políticas existentes
DROP POLICY IF EXISTS "Admins podem ver todos os backups" ON backups;
DROP POLICY IF EXISTS "Admins podem criar backups" ON backups;
DROP POLICY IF EXISTS "Admins podem atualizar backups" ON backups;
DROP POLICY IF EXISTS "Admins podem deletar backups" ON backups;
DROP POLICY IF EXISTS "Admins podem ver todos os logs" ON request_logs;
DROP POLICY IF EXISTS "Usuários podem ver seus próprios logs" ON request_logs;
DROP POLICY IF EXISTS "Usuários podem ver suas próprias roles" ON user_roles;
DROP POLICY IF EXISTS "Admins podem gerenciar roles" ON user_roles;

-- Função para verificar se um usuário é admin
DROP FUNCTION IF EXISTS is_admin(UUID);

CREATE OR REPLACE FUNCTION is_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se o usuário é admin usando apenas a tabela user_roles
  RETURN EXISTS (
    SELECT 1 
    FROM user_roles 
    WHERE user_roles.user_id = p_user_id 
    AND user_roles.role = 'admin'
  );
END;
$$;

-- Criar políticas de segurança
ALTER TABLE backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Políticas para backups
CREATE POLICY "Admins podem ver todos os backups"
  ON backups FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins podem criar backups"
  ON backups FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins podem atualizar backups"
  ON backups FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins podem deletar backups"
  ON backups FOR DELETE
  USING (is_admin(auth.uid()));

-- Políticas para logs de requisições
CREATE POLICY "Admins podem ver todos os logs"
  ON request_logs FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Usuários podem ver seus próprios logs"
  ON request_logs FOR SELECT
  USING (user_id = auth.uid());

-- Políticas para user_roles
CREATE POLICY "Usuários podem ver suas próprias roles"
  ON user_roles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins podem gerenciar roles"
  ON user_roles FOR ALL
  USING (is_admin(auth.uid()));

-- Garantir que a função is_admin tenha as permissões necessárias
GRANT EXECUTE ON FUNCTION is_admin TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin TO service_role;

-- Garantir que os usuários autenticados tenham acesso às tabelas
GRANT SELECT ON backups TO authenticated;
GRANT SELECT ON request_logs TO authenticated;
GRANT SELECT ON user_roles TO authenticated;

-- Garantir que o service_role tenha acesso total
GRANT ALL ON backups TO service_role;
GRANT ALL ON request_logs TO service_role;
GRANT ALL ON user_roles TO service_role;

-- Garantir que o schema auth seja acessível
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT USAGE ON SCHEMA auth TO service_role;

-- Função para adicionar um usuário como admin
DROP FUNCTION IF EXISTS add_admin(UUID);

CREATE OR REPLACE FUNCTION add_admin(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Inserir role admin para o usuário
  INSERT INTO user_roles (user_id, role)
  VALUES (p_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

-- Garantir que a função add_admin tenha as permissões necessárias
GRANT EXECUTE ON FUNCTION add_admin TO authenticated;
GRANT EXECUTE ON FUNCTION add_admin TO service_role;

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_backups_created_at ON backups(created_at);
CREATE INDEX IF NOT EXISTS idx_request_logs_user_id ON request_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_request_logs_created_at ON request_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role); 