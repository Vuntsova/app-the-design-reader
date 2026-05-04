-- =====================================================================
-- Shipnative Default Database Schema
-- =====================================================================
-- ⚠️ IMPORTANT: This file is kept for backwards compatibility only.
--
-- For new projects, use migrations instead:
-- 1. See supabase/migrations/README.md for migration guide
-- 2. Apply migrations using: supabase db push
-- 3. Or use Supabase SQL Editor to run migration files individually
--
-- This SQL file contains the default tables needed for the Shipnative
-- boilerplate. It can be used to manually set up your database if you
-- prefer not to use migrations.
--
-- Features included:
-- - User profiles with preferences
-- - Push notification tokens
-- - User preferences (dark mode, notifications, etc.)
-- - Waitlist table for marketing page email collection
-- =====================================================================

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================================
-- PROFILES TABLE
-- =====================================================================
-- Stores user profile information and preferences
-- This table is automatically populated when a user signs up via a trigger

CREATE TABLE IF NOT EXISTS public.profiles (
    -- Primary key (matches auth.users.id)
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Public discovery fields only — anything sensitive belongs on
    -- `user_preferences` or `private_profiles` (see warning below).
    first_name TEXT,
    last_name TEXT,
    full_name TEXT,
    avatar_url TEXT,
    bio TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- !!! WARNING: WORLD-READABLE TABLE !!!
-- =====================================================================
-- The SELECT policy below uses `USING (true)`, meaning ANY user
-- (including anonymous/unauthenticated) can read EVERY row in this table.
--
-- This is intentional for public profile discovery (e.g. showing
-- display names and avatars to other users), but it is a footgun:
--
--   NEVER store PII in this table:
--     - email addresses
--     - phone numbers
--     - mailing or billing addresses
--     - payment info / Stripe customer IDs
--     - government IDs
--     - anything else you would not want a stranger to see
--
-- For private user data, create a SEPARATE table with a per-user policy:
--
--     CREATE POLICY "Users can read own private data"
--         ON public.private_profiles
--         FOR SELECT
--         USING (auth.uid() = user_id);
--
-- See `supabase/migrations/20260428000000_add_private_profiles_example.sql`
-- for a worked example, and `vibe/SECURITY.md` for the full pattern.
-- =====================================================================

-- Profiles table is viewable by everyone (public discovery only — see warning above)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone"
    ON public.profiles
    FOR SELECT
    USING (true);

-- Users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id);

-- Users can insert their own profile
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
    ON public.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS profiles_id_idx ON public.profiles(id);

-- =====================================================================
-- PUSH NOTIFICATION TOKENS TABLE
-- =====================================================================
-- Stores Expo push notification tokens for users
-- Multiple tokens per user (different devices)

CREATE TABLE IF NOT EXISTS public.push_tokens (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- User reference
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

    -- Token data
    token TEXT NOT NULL,
    device_id TEXT,
    device_name TEXT,
    platform TEXT CHECK (platform IN ('ios', 'android', 'web')),

    -- Status
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMPTZ DEFAULT NOW(),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure one token per device
    UNIQUE(user_id, token)
);

-- Enable Row Level Security
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- Policies for push_tokens table
-- Users can view their own tokens
DROP POLICY IF EXISTS "Users can view own push tokens" ON public.push_tokens;
CREATE POLICY "Users can view own push tokens"
    ON public.push_tokens
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own tokens
DROP POLICY IF EXISTS "Users can insert own push tokens" ON public.push_tokens;
CREATE POLICY "Users can insert own push tokens"
    ON public.push_tokens
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own tokens
DROP POLICY IF EXISTS "Users can update own push tokens" ON public.push_tokens;
CREATE POLICY "Users can update own push tokens"
    ON public.push_tokens
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own tokens
DROP POLICY IF EXISTS "Users can delete own push tokens" ON public.push_tokens;
CREATE POLICY "Users can delete own push tokens"
    ON public.push_tokens
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS push_tokens_user_id_idx ON public.push_tokens(user_id);
CREATE INDEX IF NOT EXISTS push_tokens_token_idx ON public.push_tokens(token);
CREATE INDEX IF NOT EXISTS push_tokens_is_active_idx ON public.push_tokens(is_active);

-- =====================================================================
-- USER PREFERENCES TABLE
-- =====================================================================
-- Stores additional user preferences and settings
-- Can be extended with app-specific preferences

CREATE TABLE IF NOT EXISTS public.user_preferences (
    -- Primary key (matches auth.users.id)
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

    -- App preferences
    language TEXT DEFAULT 'en',
    timezone TEXT DEFAULT 'UTC',

    -- Privacy preferences
    profile_visibility TEXT DEFAULT 'public' CHECK (profile_visibility IN ('public', 'private', 'friends')),
    show_online_status BOOLEAN DEFAULT true,

    -- Communication preferences
    marketing_emails BOOLEAN DEFAULT true,
    product_updates BOOLEAN DEFAULT true,

    -- UI / notification preferences (private — never put these on `profiles`,
    -- which is world-readable for public discovery)
    dark_mode_enabled BOOLEAN DEFAULT false,
    notifications_enabled BOOLEAN DEFAULT true,
    push_notifications_enabled BOOLEAN DEFAULT true,
    email_notifications_enabled BOOLEAN DEFAULT true,

    -- Onboarding
    has_completed_onboarding BOOLEAN DEFAULT false,
    onboarding_completed_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Policies for user_preferences table
-- Users can view their own preferences
DROP POLICY IF EXISTS "Users can view own preferences" ON public.user_preferences;
CREATE POLICY "Users can view own preferences"
    ON public.user_preferences
    FOR SELECT
    USING (auth.uid() = id);

-- Users can update their own preferences
DROP POLICY IF EXISTS "Users can update own preferences" ON public.user_preferences;
CREATE POLICY "Users can update own preferences"
    ON public.user_preferences
    FOR UPDATE
    USING (auth.uid() = id);

-- Users can insert their own preferences
DROP POLICY IF EXISTS "Users can insert own preferences" ON public.user_preferences;
CREATE POLICY "Users can insert own preferences"
    ON public.user_preferences
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Create index
CREATE INDEX IF NOT EXISTS user_preferences_id_idx ON public.user_preferences(id);

-- =====================================================================
-- TRIGGERS
-- =====================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for profiles table
DROP TRIGGER IF EXISTS on_profiles_updated ON public.profiles;
CREATE TRIGGER on_profiles_updated
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Trigger for push_tokens table
DROP TRIGGER IF EXISTS on_push_tokens_updated ON public.push_tokens;
CREATE TRIGGER on_push_tokens_updated
    BEFORE UPDATE ON public.push_tokens
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Trigger for user_preferences table
DROP TRIGGER IF EXISTS on_user_preferences_updated ON public.user_preferences;
CREATE TRIGGER on_user_preferences_updated
    BEFORE UPDATE ON public.user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Create profile
    INSERT INTO public.profiles (id, first_name, last_name, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data->>'first_name',
        NEW.raw_user_meta_data->>'last_name',
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );

    -- Create user preferences with defaults
    INSERT INTO public.user_preferences (id)
    VALUES (NEW.id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- =====================================================================
-- FUNCTIONS
-- =====================================================================

-- Function to safely delete expired push tokens
CREATE OR REPLACE FUNCTION public.delete_expired_push_tokens(days_old INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.push_tokens
    WHERE last_used_at < NOW() - (days_old || ' days')::INTERVAL
    AND is_active = false;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user profile with preferences
CREATE OR REPLACE FUNCTION public.get_user_profile(user_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'profile', row_to_json(p.*),
        'preferences', row_to_json(up.*)
    ) INTO result
    FROM public.profiles p
    LEFT JOIN public.user_preferences up ON p.id = up.id
    WHERE p.id = user_id;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to delete the authenticated user and related data
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS VOID AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Must be authenticated to delete account';
    END IF;

    -- App tables (extend to any tables that reference the user)
    DELETE FROM public.push_tokens WHERE user_id = v_user_id;
    DELETE FROM public.user_preferences WHERE id = v_user_id;
    DELETE FROM public.profiles WHERE id = v_user_id;

    -- Remove the auth user (requires definer rights)
    DELETE FROM auth.users WHERE id = v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;

-- =====================================================================
-- WAITLIST TABLE
-- =====================================================================
-- Stores email addresses from the marketing page waitlist form
-- Used by the Supabase Edge Function to send confirmation emails via Resend

CREATE TABLE IF NOT EXISTS public.waitlist (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Email address (unique to prevent duplicates)
    email TEXT NOT NULL UNIQUE,

    -- Optional metadata
    source TEXT DEFAULT 'marketing_page',
    user_agent TEXT,
    ip_address TEXT,

    -- Status
    email_sent BOOLEAN DEFAULT false,
    email_sent_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Policies for waitlist table
-- NOTE: The INSERT policy below uses `WITH CHECK (true)` so anonymous
-- visitors can sign up from the marketing page. This is intentional, but
-- means you should rate-limit at the edge (Cloudflare, Vercel, or the
-- Supabase Edge Function) to prevent spam — RLS does not protect against
-- flood inserts. SELECT is locked down via `USING (false)` below.
DROP POLICY IF EXISTS "Anyone can add to waitlist" ON public.waitlist;
CREATE POLICY "Anyone can add to waitlist"
    ON public.waitlist
    FOR INSERT
    WITH CHECK (true);

-- Only authorized users can view waitlist (hardened: use service role for admin access)
DROP POLICY IF EXISTS "Only authorized users can view waitlist" ON public.waitlist;
CREATE POLICY "Only authorized users can view waitlist"
    ON public.waitlist
    FOR SELECT
    USING (false);

-- Create indexes
CREATE INDEX IF NOT EXISTS waitlist_email_idx ON public.waitlist(email);
CREATE INDEX IF NOT EXISTS waitlist_created_at_idx ON public.waitlist(created_at DESC);

-- =====================================================================
-- INITIAL DATA (OPTIONAL)
-- =====================================================================

-- You can add seed data here if needed
-- Example:
-- INSERT INTO public.user_preferences (id) VALUES (...);

-- =====================================================================
-- GRANTS (if using service role)
-- =====================================================================

-- Grant necessary permissions (adjust as needed)
-- GRANT USAGE ON SCHEMA public TO anon, authenticated;
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- =====================================================================
-- NOTES
-- =====================================================================
-- 1. This schema works with both real Supabase and Shipnative's mock mode
-- 2. All tables have Row Level Security (RLS) enabled
-- 3. Triggers automatically create profiles when users sign up
-- 4. The profiles table stores user preferences like dark mode and notifications
-- 5. Push tokens table supports multiple devices per user
-- 6. User preferences table can be extended with app-specific settings
--
-- To use this schema:
-- 1. Go to your Supabase project dashboard
-- 2. Navigate to the SQL Editor
-- 3. Copy and paste this entire file
-- 4. Click "Run" to execute
-- =====================================================================
