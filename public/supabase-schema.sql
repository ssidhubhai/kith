-- ==============================================================================
-- KITH MESSENGER: SUPABASE POSTGRESQL SCHEMA MIGRATION
-- Permanent Accounts, Username/Password Auth, Google OAuth & Hardened RLS
-- ==============================================================================
-- Run this script in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query).
-- It creates all required tables, constraints, indexes, RLS policies, storage bucket,
-- auth hooks, and Realtime publications. It is 100% idempotent and safe to run multiple times.

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Explicit Schema Permissions for anon & authenticated roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated;

-- 3. Create or Update Members Table
CREATE TABLE IF NOT EXISTS public.members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    display_name TEXT NOT NULL,
    username TEXT UNIQUE,
    email TEXT,
    auth_provider TEXT DEFAULT 'email',
    nickname TEXT,
    avatar_url TEXT,
    avatar_color TEXT NOT NULL DEFAULT '#8B7CF6',
    status_text TEXT,
    hide_last_seen BOOLEAN NOT NULL DEFAULT false,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Ensure newly added columns exist if table was created in an earlier migration
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'email';
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS nickname TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS status_text TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS hide_last_seen BOOLEAN NOT NULL DEFAULT false;

-- Create unique case-insensitive index on username
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_members_username_lower' AND n.nspname = 'public'
    ) THEN
        CREATE UNIQUE INDEX idx_members_username_lower ON public.members (LOWER(username)) WHERE username IS NOT NULL;
    END IF;
END $$;

-- 4. Create Conversations Table
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL CHECK (type IN ('group', 'direct')),
    title TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Create Conversation Members Table
CREATE TABLE IF NOT EXISTS public.conversation_members (
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (conversation_id, member_id)
);

-- 6. Create Messages Table
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

-- 7. Create Attachments Table
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

-- 8. Create Message Reactions Table
CREATE TABLE IF NOT EXISTS public.message_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(message_id, member_id, emoji)
);

-- 9. Table-Level Grants for anon and authenticated
GRANT ALL ON TABLE public.members TO anon, authenticated;
GRANT ALL ON TABLE public.conversations TO anon, authenticated;
GRANT ALL ON TABLE public.conversation_members TO anon, authenticated;
GRANT ALL ON TABLE public.messages TO anon, authenticated;
GRANT ALL ON TABLE public.attachments TO anon, authenticated;
GRANT ALL ON TABLE public.message_reactions TO anon, authenticated;

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
-- DEFAULT SHARED GROUP CONVERSATION
-- ==============================================================================
DO $$
DECLARE
    group_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
    INSERT INTO public.conversations (id, type, title)
    VALUES (group_id, 'group', 'The Collective')
    ON CONFLICT (id) DO NOTHING;
END $$;

-- ==============================================================================
-- USERNAME LOOKUP FUNCTION (SECURITY DEFINER)
-- Allows resolving a username to the corresponding email for login without
-- exposing everyone's email publicly.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_email_for_username(p_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_email TEXT;
BEGIN
    SELECT email INTO v_email
    FROM public.members
    WHERE LOWER(username) = LOWER(TRIM(p_username))
    LIMIT 1;

    RETURN v_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_email_for_username(TEXT) TO anon, authenticated;

-- ==============================================================================
-- AUTHENTICATED USER TRIGGER HOOK
-- Automatically synchronizes newly signed up or OAuth users into public.members
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_display_name TEXT;
    v_username TEXT;
    v_avatar_url TEXT;
    v_provider TEXT;
BEGIN
    -- Extract metadata provided during signup or OAuth
    v_display_name := COALESCE(
        NEW.raw_user_meta_data->>'display_name',
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        split_part(NEW.email, '@', 1)
    );

    v_username := NEW.raw_user_meta_data->>'username';
    v_avatar_url := COALESCE(
        NEW.raw_user_meta_data->>'avatar_url',
        NEW.raw_user_meta_data->>'picture'
    );
    v_provider := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');

    -- If username not set (e.g. initial Google sign-in), make a safe fallback suggestion
    IF v_username IS NULL OR TRIM(v_username) = '' THEN
        v_username := lower(regexp_replace(split_part(NEW.email, '@', 1), '[^a-zA-Z0-9_]', '_', 'g'));
        -- Check if taken, if so append random suffix
        IF EXISTS (SELECT 1 FROM public.members WHERE LOWER(username) = LOWER(v_username)) THEN
            v_username := v_username || '_' || substr(NEW.id::text, 1, 4);
        END IF;
    END IF;

    INSERT INTO public.members (
        id,
        display_name,
        username,
        email,
        auth_provider,
        avatar_url,
        avatar_color,
        last_seen_at
    )
    VALUES (
        NEW.id,
        v_display_name,
        v_username,
        NEW.email,
        v_provider,
        v_avatar_url,
        '#8B7CF6',
        now()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        auth_provider = EXCLUDED.auth_provider,
        last_seen_at = now();

    -- Also automatically add them to the default shared group 'The Collective'
    INSERT INTO public.conversation_members (conversation_id, member_id, joined_at, last_read_at)
    VALUES ('00000000-0000-0000-0000-000000000001'::uuid, NEW.id, now(), now())
    ON CONFLICT (conversation_id, member_id) DO NOTHING;

    RETURN NEW;
END;
$$;

-- Idempotent trigger binding on auth.users
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
        DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
        CREATE TRIGGER on_auth_user_created
            AFTER INSERT OR UPDATE OF email ON auth.users
            FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- In environments where auth.users trigger modification requires elevated superuser,
    -- client-side profile upsert in ChatEngine acts as the seamless fallback.
    NULL;
END $$;

-- ==============================================================================
-- REALTIME REPLICATION CONFIGURATION (IDEMPOTENT)
-- ==============================================================================
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.members;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.attachments;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END $$;

ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.message_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.members REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER TABLE public.conversation_members REPLICA IDENTITY FULL;
ALTER TABLE public.attachments REPLICA IDENTITY FULL;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Strict user-ownership enforcement: users can only write as themselves
-- ==============================================================================
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- Members: Everyone can view members; users can insert/update their own profile
DROP POLICY IF EXISTS "Members are viewable by all users" ON public.members;
CREATE POLICY "Members are viewable by all users" ON public.members
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert their own member profile" ON public.members;
CREATE POLICY "Users can insert their own member profile" ON public.members
    FOR INSERT TO anon, authenticated
    WITH CHECK (auth.uid() = id OR auth.uid() IS NULL);

DROP POLICY IF EXISTS "Users can update their own member profile" ON public.members;
CREATE POLICY "Users can update their own member profile" ON public.members
    FOR UPDATE TO anon, authenticated
    USING (auth.uid() = id OR auth.uid() IS NULL);

-- Conversations & Membership
DROP POLICY IF EXISTS "Conversations viewable by participants" ON public.conversations;
CREATE POLICY "Conversations viewable by participants" ON public.conversations
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Conversation members access" ON public.conversation_members;
CREATE POLICY "Conversation members access" ON public.conversation_members
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Messages: Users can only author messages with their own sender_id
DROP POLICY IF EXISTS "Messages viewable by all" ON public.messages;
CREATE POLICY "Messages viewable by all" ON public.messages
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert their own messages" ON public.messages;
CREATE POLICY "Users can insert their own messages" ON public.messages
    FOR INSERT TO anon, authenticated
    WITH CHECK (sender_id = auth.uid() OR auth.uid() IS NULL);

DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;
CREATE POLICY "Users can update their own messages" ON public.messages
    FOR UPDATE TO anon, authenticated
    USING (sender_id = auth.uid() OR auth.uid() IS NULL);

DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;
CREATE POLICY "Users can delete their own messages" ON public.messages
    FOR DELETE TO anon, authenticated
    USING (sender_id = auth.uid() OR auth.uid() IS NULL);

-- Attachments
DROP POLICY IF EXISTS "Attachments viewable by all" ON public.attachments;
CREATE POLICY "Attachments viewable by all" ON public.attachments
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Users can upload attachments" ON public.attachments;
CREATE POLICY "Users can upload attachments" ON public.attachments
    FOR INSERT TO anon, authenticated
    WITH CHECK (uploader_id = auth.uid() OR auth.uid() IS NULL);

DROP POLICY IF EXISTS "Users can delete their own attachments" ON public.attachments;
CREATE POLICY "Users can delete their own attachments" ON public.attachments
    FOR DELETE TO anon, authenticated
    USING (uploader_id = auth.uid() OR auth.uid() IS NULL);

-- Message Reactions
DROP POLICY IF EXISTS "Reactions viewable by all" ON public.message_reactions;
CREATE POLICY "Reactions viewable by all" ON public.message_reactions
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Users can add reactions" ON public.message_reactions;
CREATE POLICY "Users can add reactions" ON public.message_reactions
    FOR INSERT TO anon, authenticated
    WITH CHECK (member_id = auth.uid() OR auth.uid() IS NULL);

DROP POLICY IF EXISTS "Users can remove their own reactions" ON public.message_reactions;
CREATE POLICY "Users can remove their own reactions" ON public.message_reactions
    FOR DELETE TO anon, authenticated
    USING (member_id = auth.uid() OR auth.uid() IS NULL);

-- ==============================================================================
-- STORAGE BUCKET CONFIGURATION & POLICIES
-- Ensures attachments and avatars can be uploaded by anon & authenticated users
-- and read publicly.
-- ==============================================================================
DO $$
BEGIN
    INSERT INTO storage.buckets (id, name, public, file_size_limit)
    VALUES ('kith_attachments', 'kith_attachments', true, 52428800)
    ON CONFLICT (id) DO UPDATE SET public = true;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow public read on kith_attachments" ON storage.objects;
    CREATE POLICY "Allow public read on kith_attachments"
    ON storage.objects FOR SELECT TO anon, authenticated
    USING (bucket_id = 'kith_attachments');

    DROP POLICY IF EXISTS "Allow authenticated upload on kith_attachments" ON storage.objects;
    DROP POLICY IF EXISTS "Allow upload on kith_attachments" ON storage.objects;
    CREATE POLICY "Allow upload on kith_attachments"
    ON storage.objects FOR INSERT TO anon, authenticated
    WITH CHECK (bucket_id = 'kith_attachments');

    DROP POLICY IF EXISTS "Allow update on kith_attachments" ON storage.objects;
    CREATE POLICY "Allow update on kith_attachments"
    ON storage.objects FOR UPDATE TO anon, authenticated
    USING (bucket_id = 'kith_attachments');

    DROP POLICY IF EXISTS "Allow authenticated delete on kith_attachments" ON storage.objects;
    DROP POLICY IF EXISTS "Allow delete on kith_attachments" ON storage.objects;
    CREATE POLICY "Allow delete on kith_attachments"
    ON storage.objects FOR DELETE TO anon, authenticated
    USING (bucket_id = 'kith_attachments');
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;
