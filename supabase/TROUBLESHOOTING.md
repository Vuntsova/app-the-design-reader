# Supabase Troubleshooting Guide

## Common Issues and Solutions

### 404 Errors on Preferences Queries After Signup

**Symptom**: After signing up, you see 404 errors in the browser console like:
```
GET https://your-project.supabase.co/rest/v1/user_preferences?select=dark_mode_enabled,notifications_enabled,push_notifications_enabled,email_notifications_enabled&id=eq.USER_ID 404
```

(Older versions of the boilerplate stored these columns on `profiles`. They were
moved to `user_preferences` because `profiles` is world-readable for public
discovery — see `supabase/migrations/20260505000000_move_private_prefs_off_profiles.sql`.)

**Root Causes**:

1. **Profile not created yet** - The trigger that creates the profile hasn't fired or completed
2. **RLS policies preventing access** - Row Level Security policies may be blocking the query
3. **Table doesn't exist** - The database schema hasn't been applied yet

**Solutions**:

#### Solution 1: Ensure Database Schema is Applied

Make sure you've applied the database schema to your Supabase project:

**Using Migrations (Recommended)**:
```bash
# Link your project (one-time)
supabase link --project-ref your-project-ref

# Apply migrations
supabase db push
```

**Using SQL Editor (Manual)**:
1. Go to your Supabase Dashboard → SQL Editor
2. Copy contents from `supabase/migrations/20260122101738_initial_schema.sql`
3. Paste and click "Run"

#### Solution 2: Verify the Trigger is Working

The `handle_new_user()` function should automatically create a profile when a user signs up. Check if it's working:

1. Go to Supabase Dashboard → SQL Editor
2. Run this query to check if profiles are being created:
   ```sql
   SELECT id, first_name, last_name, created_at
   FROM public.profiles
   WHERE id = 'YOUR_USER_ID';
   ```

If no profile exists, check if the trigger is enabled:
```sql
SELECT * FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
```

#### Solution 3: Manually Create Missing Profiles

If profiles are missing for existing users, you can create them manually:

```sql
-- Insert profiles for users who don't have one
INSERT INTO public.profiles (id, created_at)
SELECT id, created_at
FROM auth.users
WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE profiles.id = users.id
);
```

#### Solution 4: Check RLS Policies

Verify that the RLS policies allow users to read their own profiles:

```sql
-- Check existing policies
SELECT * FROM pg_policies WHERE tablename = 'profiles';
```

The policies should include:
- `Public profiles are viewable by everyone` - Allows SELECT for all users
- `Users can update own profile` - Allows UPDATE for auth.uid() = id
- `Users can insert own profile` - Allows INSERT for auth.uid() = id

If policies are missing, re-run the migration or add them manually.

#### Solution 5: Handle 404 Errors Gracefully in Code

The app already handles this gracefully in `preferencesSync.ts:63-67`:

```typescript
if (error) {
  // Table might not exist or user has no profile yet - that's okay
  logger.debug("Failed to fetch user preferences", { error: error.message })
  return null
}
```

This prevents the app from crashing when profiles don't exist yet. The 404 errors in the console are informational and don't break functionality.

### Wrong Localhost Port Configuration

**Symptom**: Login fails because Supabase is redirecting to the wrong localhost port (e.g., port 3000 instead of 8081).

**Solution**:

1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Update the redirect URLs to match your Expo dev server port:
   - Add `exp://localhost:8081`
   - Add `http://localhost:8081`
3. Remove or update any incorrect URLs (like `http://localhost:3000`)

For Expo development, the typical ports are:
- **Metro bundler**: 8081
- **Expo Go**: 19000 or 19001
- **Web**: 8081 (default)

### TypeScript Errors with React Native

**Symptom**: TypeScript errors like:
```
error TS6200: Definitions conflict with those in another file: EndingType, BlobPart, BufferSource, FormData, RequestInfo...
error TS2403: Subsequent variable declarations must have the same type. Variable 'require' must be of type 'Require', but here has type 'NodeRequire'
```

**Root Cause**: Including both DOM and Node types in a React Native project causes conflicts with React Native's own type definitions.

**Solution**: This has been fixed in the boilerplate. The `apps/app/tsconfig.json` now:
- Removes `"dom"` from the `lib` array (React Native provides its own web-like APIs)
- Removes `"node"` from the `types` array
- Removes `typeRoots` configuration (TypeScript discovers types automatically)

If you encounter this issue:
1. Check your `tsconfig.json`
2. Ensure `lib: ["esnext"]` (no "dom")
3. Ensure `types: ["jest"]` (no "node")
4. Remove `typeRoots` if present

### Convex Provider Error When Using Supabase

**Symptom**: App crashes with error:
```
Error: Could not find `ConvexProviderWithAuth` (or `ConvexProviderWithClerk` or `ConvexProviderWithAuth0`) as an ancestor component.
```

**Root Cause**: You have `EXPO_PUBLIC_CONVEX_URL` defined in your `.env` file even though you're using Supabase (`EXPO_PUBLIC_BACKEND_PROVIDER=supabase`).

**Solution**:

1. Open `apps/app/.env`
2. Comment out or remove the Convex URL line:
   ```bash
   # EXPO_PUBLIC_CONVEX_URL=http://127.0.0.1:3210
   ```
3. Restart the app:
   ```bash
   yarn app:ios
   # or
   yarn app:android
   ```

**Why this happens**: The app tries to initialize both backend providers to satisfy React's rules of hooks. Having a Convex URL defined triggers Convex initialization code even when Supabase is selected.

**Note**: This has been fixed in the boilerplate. The `useAuth` hook now gracefully handles this case by returning stub implementations when Convex is not the selected backend.

### Migration Already Applied Errors

**Symptom**: When applying migrations, you get errors like:
```
ERROR: relation "profiles" already exists
ERROR: policy "Users can view own profile" already exists
```

**Solution**: This happens if you manually applied the schema before using migrations. To fix:

**Option 1: Reset Local Database (Development Only)**
```bash
supabase db reset
```

**Option 2: Mark Migration as Applied (Production)**

If the schema already exists in production and matches the migration:

```bash
# Mark migration as applied without running it
supabase migration repair --status applied 20260122101738
```

**Option 3: Make Migrations Idempotent**

All migrations should use `IF NOT EXISTS` and `IF EXISTS` clauses:
```sql
CREATE TABLE IF NOT EXISTS public.my_table (...);
DROP POLICY IF EXISTS "policy_name" ON public.my_table;
CREATE POLICY "policy_name" ON public.my_table ...;
```

### RLS Blocking All Queries

**Symptom**: All database queries return empty results or fail with permission denied.

**Solution**:

1. Check if RLS is enabled:
   ```sql
   SELECT tablename, rowsecurity
   FROM pg_tables
   WHERE schemaname = 'public';
   ```

2. Verify policies exist:
   ```sql
   SELECT * FROM pg_policies WHERE schemaname = 'public';
   ```

3. Test policies as a specific user:
   ```sql
   -- Test SELECT policy
   SELECT * FROM public.profiles WHERE auth.uid() = 'USER_ID';
   ```

4. Temporarily disable RLS for debugging (DEV ONLY):
   ```sql
   ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
   ```
   **Important**: Re-enable RLS before deploying to production!

### Storage/Upload Issues

**Symptom**: File uploads fail or return 403 errors.

**Solution**:

1. Check if storage bucket exists and has correct policies
2. Verify the bucket name matches your code
3. Check RLS policies on the storage bucket
4. Ensure authenticated users have upload permissions

See [SUPABASE.md](../vibe/SUPABASE.md) for storage configuration.

## Getting Help

If you encounter issues not covered here:

1. Check the [Supabase Documentation](https://supabase.com/docs)
2. Search [Supabase GitHub Issues](https://github.com/supabase/supabase/issues)
3. Ask in [Supabase Discord](https://discord.supabase.com)
4. Check the [Shipnative Documentation](../vibe/)

## Debugging Tips

### Enable Debug Logging

In your app, enable debug logging to see what's happening:

```typescript
import { logger } from '@/utils/Logger'

// The logger automatically logs Supabase operations in debug mode
```

### Check Supabase Logs

1. Go to Supabase Dashboard → Logs
2. Select "Postgres Logs" or "API Logs"
3. Look for errors or unusual patterns

### Use the SQL Editor

Test queries directly in the Supabase SQL Editor to isolate issues:

1. Go to Supabase Dashboard → SQL Editor
2. Write your query
3. Click "Run"
4. Check the results

### Test RLS Policies

Test RLS policies as a specific user:

```sql
-- Set the user context
SELECT auth.uid(); -- Returns current user

-- Test query
SELECT * FROM public.profiles WHERE id = auth.uid();
```

### Clear Browser Cache

Sometimes cached responses cause issues:

1. Open DevTools (F12)
2. Right-click the Refresh button
3. Select "Empty Cache and Hard Reload"
