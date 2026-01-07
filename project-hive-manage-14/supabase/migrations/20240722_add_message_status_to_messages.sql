-- Adiciona campo de status de entrega/leitura para mensagens WhatsApp
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS status text check (status in ('sent', 'delivered', 'read')) DEFAULT 'sent';
-- Opcional: index para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_messages_status ON public.messages(status); 