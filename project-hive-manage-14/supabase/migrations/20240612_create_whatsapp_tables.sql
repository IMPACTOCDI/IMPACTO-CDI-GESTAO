-- Tabela de conversas do WhatsApp
create table if not exists public.conversations (
    id uuid primary key default gen_random_uuid(),
    contact_name text not null,
    contact_number text not null,
    assigned_to uuid references auth.users(id) on delete set null,
    status text not null check (status in ('novo', 'em_atendimento', 'fechado')) default 'novo',
    last_message text,
    updated_at timestamptz not null default now()
);

-- Tabela de mensagens do WhatsApp
create table if not exists public.messages (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid references public.conversations(id) on delete cascade,
    sender text not null check (sender in ('client', 'attendant')),
    content text not null,
    created_at timestamptz not null default now()
);

-- Índices para performance
create index if not exists idx_conversations_assigned_to on public.conversations(assigned_to);
create index if not exists idx_messages_conversation_id on public.messages(conversation_id); 