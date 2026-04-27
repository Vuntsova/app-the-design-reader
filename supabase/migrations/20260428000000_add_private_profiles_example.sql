-- =====================================================================
-- Worked example: per-user private data table
-- =====================================================================
-- The default `public.profiles` table is world-readable so other users
-- can discover display names and avatars. That makes it unsafe for
-- anything sensitive (email, phone, billing info, internal notes, etc.).
--
-- This migration creates a companion `public.private_profiles` table
-- with a strict per-user RLS policy: each row is only visible to the
-- user it belongs to. Use this as the template whenever you need to
-- store data that should NOT be publicly discoverable.
--
-- The pattern:
--   1. `user_id` references `auth.users(id)` with `ON DELETE CASCADE`.
--   2. RLS is enabled on the table.
--   3. SELECT / INSERT / UPDATE policies all check `auth.uid() = user_id`.
--   4. No DELETE policy — wire that up explicitly if you need it.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.private_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Example private fields — replace with whatever your app needs
    internal_notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for the per-user lookup we'll be doing constantly
CREATE INDEX IF NOT EXISTS private_profiles_user_id_idx
    ON public.private_profiles(user_id);

-- Enable Row Level Security
ALTER TABLE public.private_profiles ENABLE ROW LEVEL SECURITY;

-- SELECT: a user can only read their own row
DROP POLICY IF EXISTS "Users can read own private profile" ON public.private_profiles;
CREATE POLICY "Users can read own private profile"
    ON public.private_profiles
    FOR SELECT
    USING (auth.uid() = user_id);

-- INSERT: a user can only insert a row for themselves
DROP POLICY IF EXISTS "Users can insert own private profile" ON public.private_profiles;
CREATE POLICY "Users can insert own private profile"
    ON public.private_profiles
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- UPDATE: a user can only update their own row
DROP POLICY IF EXISTS "Users can update own private profile" ON public.private_profiles;
CREATE POLICY "Users can update own private profile"
    ON public.private_profiles
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Reuse the shared updated_at trigger function from the initial schema
DROP TRIGGER IF EXISTS on_private_profiles_updated ON public.private_profiles;
CREATE TRIGGER on_private_profiles_updated
    BEFORE UPDATE ON public.private_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
