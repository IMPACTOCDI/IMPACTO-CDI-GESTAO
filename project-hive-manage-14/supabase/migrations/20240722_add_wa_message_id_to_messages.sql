-- Adiciona campo para armazenar o ID da mensagem do WhatsApp
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS wa_message_id text;
CREATE INDEX IF NOT EXISTS idx_messages_wa_message_id ON public.messages(wa_message_id); 