-- ==============================================================================
-- KITH MESSENGER: SUPABASE POSTGRESQL SCHEMA MIGRATION
-- ==============================================================================
-- Run this script in the Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- It creates all required tables, indexes, constraints, RLS policies, and realtime publications.

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create Members Table
CREATE TABLE IF NOT EXISTS public.members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    display_name TEXT NOT NULL,
    nickname TEXT,
    avatar_url TEXT,
    avatar_color TEXT NOT NULL DEFAULT '#8B7CF6',
    status_text TEXT,
    hide_last_seen BOOLEAN NOT NULL DEFAULT false,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Idempotent column additions for existing installations:
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS nickname TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS status_text TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS hide_last_seen BOOLEAN NOT NULL DEFAULT false;

-- 3. Create Conversations Table
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL CHECK (type IN ('group', 'direct')),
    title TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Create Conversation Members Table
CREATE TABLE IF NOT EXISTS public.conversation_members (
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (conversation_id, member_id)
);

-- 5. Create Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'file', 'system')),
    reply_to_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    is_forwarded BOOLEAN NOT NULL DEFAULT false,
    forwarded_from TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_forwarded BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS forwarded_from TEXT;

-- 6. Create Attachments Table
CREATE TABLE IF NOT EXISTS public.attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    uploader_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    original_filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
    file_size BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. Create Message Reactions Table
CREATE TABLE IF NOT EXISTS public.message_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(message_id, member_id, emoji)
);

-- ==============================================================================
-- INDEXES FOR HIGH-PERFORMANCE REALTIME QUERIES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created 
    ON public.messages (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_sender 
    ON public.messages (sender_id);

CREATE INDEX IF NOT EXISTS idx_messages_reply_to 
    ON public.messages (reply_to_message_id);

CREATE INDEX IF NOT EXISTS idx_conversation_members_member 
    ON public.conversation_members (member_id);

CREATE INDEX IF NOT EXISTS idx_attachments_conversation 
    ON public.attachments (conversation_id);

CREATE INDEX IF NOT EXISTS idx_attachments_message 
    ON public.attachments (message_id);

CREATE INDEX IF NOT EXISTS idx_reactions_message 
    ON public.message_reactions (message_id);

CREATE INDEX IF NOT EXISTS idx_members_last_seen 
    ON public.members (last_seen_at DESC);

-- ==============================================================================
-- DEFAULT SHARED GROUP CONVERSATION & SEED MEMBERS
-- ==============================================================================
DO $$
DECLARE
    group_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
    -- Insert default group conversation if not exists
    INSERT INTO public.conversations (id, type, title)
    VALUES (group_id, 'group', 'The Collective')
    ON CONFLICT (id) DO NOTHING;
END $$;

-- ==============================================================================
-- REALTIME REPLICATION CONFIGURATION
-- ==============================================================================
-- Enable Realtime publication for tables so Supabase Realtime delivers live events
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attachments;

-- Set replica identity to FULL so UPDATE and DELETE events include old record values
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.message_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.members REPLICA IDENTITY FULL;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- Allow public read/write for small trusted friend group with anon key
-- (For production, a shared room secret or token can be passed in headers)
CREATE POLICY "Allow members access" ON public.members
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow conversations access" ON public.conversations
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow conversation members access" ON public.conversation_members
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow messages access" ON public.messages
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow attachments access" ON public.attachments
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow reactions access" ON public.message_reactions
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ==============================================================================
-- STORAGE BUCKET CONFIGURATION & POLICIES
-- ==============================================================================
-- Create the kith_attachments bucket if not already created
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('kith_attachments', 'kith_attachments', true, 52428800)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow public view/download of attachments
CREATE POLICY "Allow public read on kith_attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'kith_attachments');

-- Allow friends to upload attachments
CREATE POLICY "Allow anon upload on kith_attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'kith_attachments');

-- Allow friends to delete/update attachments
CREATE POLICY "Allow anon delete on kith_attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'kith_attachments');
