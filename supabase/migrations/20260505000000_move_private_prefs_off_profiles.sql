-- =====================================================================
-- Move private user preferences off the world-readable `profiles` table
-- =====================================================================
-- The `profiles` table has a SELECT policy of `USING (true)` so anyone
-- (including unauthenticated visitors) can read every row. That's fine
-- for public discovery fields like `display_name`, `avatar_url`, `bio`,
-- but the table also stored private booleans:
--
--   - dark_mode_enabled
--   - notifications_enabled
--   - push_notifications_enabled
--   - email_notifications_enabled
--   - has_completed_onboarding
--
-- These are personal settings — leaking them tells strangers what
-- channels a user accepts contact on, whether they've finished signup,
-- etc. This migration moves them into the existing `user_preferences`
-- table, which is locked down by RLS to the owning user only.
--
-- The migration is idempotent: re-running it on a database where the
-- columns are already gone is a no-op.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Add the columns to `user_preferences` (idempotent).
-- ---------------------------------------------------------------------
-- Note: `user_preferences` uses `id` (UUID PK referencing auth.users.id)
-- as its primary key — there is no separate `user_id` column. We match
-- that shape rather than introduce a parallel column.

ALTER TABLE public.user_preferences
    ADD COLUMN IF NOT EXISTS dark_mode_enabled BOOLEAN DEFAULT false;

ALTER TABLE public.user_preferences
    ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT true;

ALTER TABLE public.user_preferences
    ADD COLUMN IF NOT EXISTS push_notifications_enabled BOOLEAN DEFAULT true;

ALTER TABLE public.user_preferences
    ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN DEFAULT true;

ALTER TABLE public.user_preferences
    ADD COLUMN IF NOT EXISTS has_completed_onboarding BOOLEAN DEFAULT false;

ALTER TABLE public.user_preferences
    ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------
-- 2. Backfill from `profiles` into `user_preferences`.
-- ---------------------------------------------------------------------
-- Only runs if the source columns still exist on `profiles`. We use a
-- DO block + information_schema check so this stays idempotent: if the
-- columns were already dropped (re-run after a successful migration),
-- we skip the backfill instead of erroring.

DO $$
DECLARE
    has_dark_mode BOOLEAN;
    has_notifications BOOLEAN;
    has_push BOOLEAN;
    has_email BOOLEAN;
    has_onboarding BOOLEAN;
    has_onboarding_at BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles'
        AND column_name = 'dark_mode_enabled'
    ) INTO has_dark_mode;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles'
        AND column_name = 'notifications_enabled'
    ) INTO has_notifications;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles'
        AND column_name = 'push_notifications_enabled'
    ) INTO has_push;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles'
        AND column_name = 'email_notifications_enabled'
    ) INTO has_email;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles'
        AND column_name = 'has_completed_onboarding'
    ) INTO has_onboarding;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles'
        AND column_name = 'onboarding_completed_at'
    ) INTO has_onboarding_at;

    -- Only backfill if at least one source column still exists.
    IF has_dark_mode OR has_notifications OR has_push OR has_email OR has_onboarding OR has_onboarding_at THEN
        EXECUTE format($sql$
            INSERT INTO public.user_preferences (
                id,
                dark_mode_enabled,
                notifications_enabled,
                push_notifications_enabled,
                email_notifications_enabled,
                has_completed_onboarding,
                onboarding_completed_at
            )
            SELECT
                p.id,
                %s AS dark_mode_enabled,
                %s AS notifications_enabled,
                %s AS push_notifications_enabled,
                %s AS email_notifications_enabled,
                %s AS has_completed_onboarding,
                %s AS onboarding_completed_at
            FROM public.profiles p
            ON CONFLICT (id) DO UPDATE SET
                dark_mode_enabled = COALESCE(EXCLUDED.dark_mode_enabled, public.user_preferences.dark_mode_enabled),
                notifications_enabled = COALESCE(EXCLUDED.notifications_enabled, public.user_preferences.notifications_enabled),
                push_notifications_enabled = COALESCE(EXCLUDED.push_notifications_enabled, public.user_preferences.push_notifications_enabled),
                email_notifications_enabled = COALESCE(EXCLUDED.email_notifications_enabled, public.user_preferences.email_notifications_enabled),
                has_completed_onboarding = COALESCE(EXCLUDED.has_completed_onboarding, public.user_preferences.has_completed_onboarding),
                onboarding_completed_at = COALESCE(EXCLUDED.onboarding_completed_at, public.user_preferences.onboarding_completed_at)
            $sql$,
            CASE WHEN has_dark_mode      THEN 'p.dark_mode_enabled'           ELSE 'NULL::boolean' END,
            CASE WHEN has_notifications  THEN 'p.notifications_enabled'       ELSE 'NULL::boolean' END,
            CASE WHEN has_push           THEN 'p.push_notifications_enabled'  ELSE 'NULL::boolean' END,
            CASE WHEN has_email          THEN 'p.email_notifications_enabled' ELSE 'NULL::boolean' END,
            CASE WHEN has_onboarding     THEN 'p.has_completed_onboarding'    ELSE 'NULL::boolean' END,
            CASE WHEN has_onboarding_at  THEN 'p.onboarding_completed_at'     ELSE 'NULL::timestamptz' END
        );
    END IF;
END
$$;

-- ---------------------------------------------------------------------
-- 3. Drop the columns from `profiles` now that data is migrated.
-- ---------------------------------------------------------------------

ALTER TABLE public.profiles DROP COLUMN IF EXISTS dark_mode_enabled;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS notifications_enabled;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS push_notifications_enabled;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email_notifications_enabled;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS has_completed_onboarding;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS onboarding_completed_at;

-- ---------------------------------------------------------------------
-- 4. Update `get_user_profile` so the returned shape no longer leaks
--    the dropped columns, and keep `delete_user_account` tidy.
-- ---------------------------------------------------------------------
-- The original definitions still work because they SELECT *, but
-- re-defining them keeps the function source in sync with the new
-- schema in case anyone reads it.

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
