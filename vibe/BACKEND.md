# Backend Setup Guide

Shipnative supports two backend options: **Supabase** and **Convex**. Choose based on your needs:

| Backend | Best For | Database | Auth | Real-time |
|---------|----------|----------|------|-----------|
| **Supabase** | SQL apps, PostgreSQL fans | PostgreSQL + RLS | Email, OAuth, Magic Link | Postgres Changes |
| **Convex** | TypeScript-first, reactive apps | Document DB | Email, OAuth (Auth.js) | Built-in reactivity |

Configure via `yarn setup` or set `EXPO_PUBLIC_BACKEND_PROVIDER=supabase|convex`.

## Optional Dependencies

**Note**: As of the latest update, Convex packages (`convex`, `@convex-dev/auth`) are included in `package.json` by default but are **only loaded when needed**. The `BackendProvider` uses conditional imports to prevent requiring these packages when using Supabase.

If you want to remove Convex packages entirely (after running `yarn setup` and choosing Supabase):

```bash
# Remove Convex dependencies
yarn remove convex @convex-dev/auth

# Remove Convex provider files
rm -rf apps/app/app/providers/Convex*.tsx
rm -rf convex/
```

This is safe to do if you're only using Supabase. The app will work without any Convex packages installed.

---

## Supabase Backend

Complete guide for setting up your Shipnative backend with Supabase, including universal database schemas, Edge Functions, and best practices.

> For Convex setup, see [CONVEX.md](./CONVEX.md).

## Quick Start

### 1. Initialize Supabase

```bash
# Install Supabase CLI
yarn global add supabase
# or: npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Initialize migrations
supabase db reset
```

### 2. Apply Default Schema

**Option A: Using Supabase Dashboard (Recommended for Quick Setup)**

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open the `supabase/schema.sql` file from the repository
4. Copy and paste the entire file into the SQL Editor
5. Click **Run** to execute

**Option B: Using Migrations**

```bash
# Copy the schema to migrations folder
cp supabase/schema.sql supabase/migrations/20240101000000_initial_schema.sql

# Apply all migrations
supabase db push

# Or run specific migration
supabase migration up
```

### 3. Default Schema Includes

The `supabase/schema.sql` file includes:

- **profiles** - User profile information with preferences (dark mode, notifications, etc.)
- **push_tokens** - Expo push notification tokens for multiple devices
- **user_preferences** - Extended user preferences and settings
- **waitlist** - Email addresses from marketing page waitlist form (for pre-launch email collection)
- Automatic triggers for profile creation on signup
- Row Level Security (RLS) policies
- Helper functions for common operations

---

## Universal Database Schemas

These are production-ready schemas that every app needs. The default schema is available in `supabase/schema.sql`.

### User Profiles

Extends Supabase `auth.users` with app-specific data. This table is automatically managed by triggers.

```sql
-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    -- Primary key (matches auth.users.id)
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Profile information
    first_name TEXT,
    last_name TEXT,
    full_name TEXT,
    avatar_url TEXT,
    bio TEXT,

    -- User preferences (integrated into profile for simplicity)
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

-- Enable RLS
alter table public.profiles enable row level security;

-- !!! WORLD-READABLE TABLE !!!
-- The SELECT policy below uses USING (true), so any user — including
-- anonymous visitors — can read every row. This is intentional for public
-- profile discovery, but it is a footgun. Never store PII (email, phone,
-- billing info, government IDs) on this table. Put private fields on a
-- separate per-user table. See "Storing private user data" below and
-- `supabase/schema.sql:60-86` for the full warning.

-- Policies
create policy "Public profiles are viewable by everyone"
  on profiles for select
  using ( true );

create policy "Users can insert their own profile"
  on profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile"
  on profiles for update
  using ( auth.uid() = id );

-- Trigger to create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, first_name, last_name, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  
  -- Also create associated preferences
  insert into public.user_preferences (id)
  values (new.id);
  
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Function to update updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_profile_updated
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();
```

### User Preferences

Store extended user preferences and app settings.

```sql
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

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

alter table public.user_preferences enable row level security;

create policy "Users can view own preferences"
  on user_preferences for select
  using ( auth.uid() = id );

create policy "Users can update own preferences"
  on user_preferences for update
  using ( auth.uid() = id );

create trigger on_user_preferences_updated
  before update on public.user_preferences
  for each row execute procedure public.handle_updated_at();
```

### Push Notification Tokens

Stores Expo push notification tokens for users, supporting multiple devices.

```sql
CREATE TABLE IF NOT EXISTS public.push_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    token TEXT NOT NULL,
    device_id TEXT,
    device_name TEXT,
    platform TEXT CHECK (platform IN ('ios', 'android', 'web')),
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, token)
);

alter table public.push_tokens enable row level security;

create policy "Users can view own push tokens"
    on push_tokens for select
    using (auth.uid() = user_id);

create policy "Users can insert own push tokens"
    on push_tokens for insert
    with check (auth.uid() = user_id);
```

### Waitlist

Store email addresses from marketing page waitlist form.

```sql
CREATE TABLE IF NOT EXISTS public.waitlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL UNIQUE,
    source TEXT DEFAULT 'marketing_page',
    user_agent TEXT,
    ip_address TEXT,
    email_sent BOOLEAN DEFAULT false,
    email_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

alter table public.waitlist enable row level security;

create policy "Anyone can add to waitlist"
    on waitlist for insert
    with check (true);
```

### Extension Tables (Optional)

The following tables are not in the default `supabase/schema.sql` but are recommended for most applications.

### File Uploads / Media

Track uploaded files and media.

```sql
create table public.uploads (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- File Info
  filename text not null,
  file_path text not null,
  file_size bigint not null,
  mime_type text not null,
  
  -- Storage Info
  bucket text not null default 'uploads',
  
  -- Metadata
  width integer,
  height integer,
  duration integer, -- for videos/audio
  metadata jsonb default '{}'::jsonb,
  
  -- Status
  status text default 'active' check (status in ('active', 'deleted', 'processing'))
);

alter table public.uploads enable row level security;

create policy "Users can view own uploads"
  on uploads for select
  using ( auth.uid() = user_id );

create policy "Users can insert own uploads"
  on uploads for insert
  with check ( auth.uid() = user_id );

create policy "Users can delete own uploads"
  on uploads for delete
  using ( auth.uid() = user_id );

-- Index for faster queries
create index uploads_user_id_idx on public.uploads(user_id);
create index uploads_created_at_idx on public.uploads(created_at desc);
```

### Audit Logs

Track important user actions for security and debugging.

```sql
create table public.audit_logs (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Who
  user_id uuid references auth.users on delete set null,
  
  -- What
  action text not null,
  resource_type text not null,
  resource_id uuid,
  
  -- Details
  changes jsonb,
  metadata jsonb default '{}'::jsonb,
  
  -- Context
  ip_address inet,
  user_agent text
);

alter table public.audit_logs enable row level security;

-- Only admins can view audit logs
-- (Assumes a `role text` column on profiles — see "Pattern 3: Role-Based Access".)
create policy "Only admins can view audit logs"
  on audit_logs for select
  using ( 
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- Index for faster queries
create index audit_logs_user_id_idx on public.audit_logs(user_id);
create index audit_logs_created_at_idx on public.audit_logs(created_at desc);
create index audit_logs_action_idx on public.audit_logs(action);

-- Function to log actions
create or replace function public.log_action(
  p_action text,
  p_resource_type text,
  p_resource_id uuid default null,
  p_changes jsonb default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid as $$
declare
  v_log_id uuid;
begin
  insert into public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    changes,
    metadata
  ) values (
    auth.uid(),
    p_action,
    p_resource_type,
    p_resource_id,
    p_changes,
    p_metadata
  ) returning id into v_log_id;
  
  return v_log_id;
end;
$$ language plpgsql security definer;
```

---

## Row Level Security (RLS) Patterns

### Pattern 1: User-Owned Resources

```sql
-- Users can only access their own data
create policy "Users can view own data"
  on table_name for select
  using ( auth.uid() = user_id );

create policy "Users can insert own data"
  on table_name for insert
  with check ( auth.uid() = user_id );

create policy "Users can update own data"
  on table_name for update
  using ( auth.uid() = user_id );

create policy "Users can delete own data"
  on table_name for delete
  using ( auth.uid() = user_id );
```

### Pattern 2: Public Read, Owner Write

```sql
-- Anyone can read, only owner can write
create policy "Public read access"
  on table_name for select
  using ( true );

create policy "Owner write access"
  on table_name for insert
  with check ( auth.uid() = user_id );

create policy "Owner update access"
  on table_name for update
  using ( auth.uid() = user_id );
```

### Pattern 3: Role-Based Access

Add a dedicated `role` column to `profiles` (or a separate `user_roles` table for multi-role setups). Don't stuff roles into `metadata->>'role'` — there's no `metadata` column on the default `profiles` schema, and a typed column gets you a CHECK constraint and indexable lookups for free.

```sql
-- One-time: add the column
alter table public.profiles
  add column if not exists role text not null default 'user'
    check (role in ('user', 'admin', 'moderator'));

create index if not exists profiles_role_idx on public.profiles(role);

-- Admin can do everything, users can read
create policy "Admins have full access"
  on table_name for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

create policy "Users can read"
  on table_name for select
  using ( true );
```

### Storing private user data

Anything you would not want a stranger to read — email, phone, mailing address, billing info, Stripe customer ID, government IDs — must NOT live on `profiles`. The `profiles` SELECT policy uses `USING (true)`, so any anonymous visitor can read every row.

The pattern is a sibling table with an owner-only policy. See `supabase/migrations/20260428000000_add_private_profiles_example.sql` for a worked example:

```sql
CREATE TABLE public.private_profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email_contact TEXT,
    phone TEXT,
    -- ... whatever PII you need
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.private_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own private profile"
    ON public.private_profiles FOR SELECT
    USING (auth.uid() = user_id);
```

Apply the same `auth.uid() = user_id` pattern for INSERT and UPDATE.

---

## Edge Functions

### Webhook Handler (Stripe, RevenueCat, etc.)

`supabase/functions/webhook-handler/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const signature = req.headers.get('stripe-signature')
    const body = await req.text()
    
    // Verify webhook signature
    // Process webhook event
    // Update database
    
    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
```

### Scheduled Task (Cron Job)

`supabase/functions/daily-cleanup/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    // Delete old audit logs (older than 90 days)
    const { error } = await supabase
      .from('audit_logs')
      .delete()
      .lt('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())

    if (error) throw error

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
```

### User Data Export (GDPR Compliance)

`supabase/functions/export-user-data/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '',
    { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
  )

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    // Fetch all user data
    const [profile, settings, uploads, logs] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('user_settings').select('*').eq('user_id', user.id).single(),
      supabase.from('uploads').select('*').eq('user_id', user.id),
      supabase.from('audit_logs').select('*').eq('user_id', user.id),
    ])

    const userData = {
      user: user,
      profile: profile.data,
      settings: settings.data,
      uploads: uploads.data,
      audit_logs: logs.data,
    }

    return new Response(JSON.stringify(userData), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="user-data-${user.id}.json"`,
      },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 401,
    })
  }
})
```

---

## Migration Scripts

### Create Migration

```bash
# Create new migration
supabase migration new add_profiles_table

# Edit the migration file in supabase/migrations/
```

### Example Migration File

`supabase/migrations/20240101000000_initial_schema.sql`:

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create profiles table
create table public.profiles (
  -- ... (schema from above)
);

-- Create user_settings table
create table public.user_settings (
  -- ... (schema from above)
);

-- Create uploads table
create table public.uploads (
  -- ... (schema from above)
);

-- Create audit_logs table
create table public.audit_logs (
  -- ... (schema from above)
);

-- Create all triggers and functions
-- ... (from above)
```

---

## Best Practices

### 1. Always Use RLS

```sql
-- Enable RLS on every table
alter table public.your_table enable row level security;
```

### 2. Use Triggers for Timestamps

```sql
-- Auto-update updated_at
create trigger on_table_updated
  before update on public.your_table
  for each row execute procedure public.handle_updated_at();
```

### 3. Index Foreign Keys

```sql
-- Speed up joins
create index table_user_id_idx on public.your_table(user_id);
```

### 4. Use JSONB for Flexible Data

```sql
-- Store flexible metadata
metadata jsonb default '{}'::jsonb
```

### 5. Soft Deletes

```sql
-- Add deleted_at instead of hard deletes
deleted_at timestamp with time zone,

-- Filter out deleted records
where deleted_at is null
```

---

## Storage Buckets

### Create Buckets

```sql
-- Create avatars bucket
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true);

-- Create uploads bucket (private)
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', false);
```

### Storage Policies

```sql
-- Allow users to upload their own avatars
create policy "Users can upload own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow users to view their own uploads
create policy "Users can view own uploads"
  on storage.objects for select
  using (
    bucket_id = 'uploads' and
    auth.uid()::text = (storage.foldername(name))[1]
  );
```

---

## Testing

### Test RLS Policies

```sql
-- Test as specific user
set local role authenticated;
set local request.jwt.claim.sub = 'user-uuid-here';

-- Run queries
select * from profiles;

-- Reset
reset role;
```

### Seed Data

```sql
-- Insert test users
insert into auth.users (id, email)
values 
  ('11111111-1111-1111-1111-111111111111', 'test1@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'test2@example.com');

-- Insert test profiles
insert into public.profiles (id, username, full_name)
values
  ('11111111-1111-1111-1111-111111111111', 'testuser1', 'Test User 1'),
  ('22222222-2222-2222-2222-222222222222', 'testuser2', 'Test User 2');
```

---

## Next Steps (Supabase)

1. Copy the schemas you need to `supabase/migrations/`
2. Run `supabase db push` to apply migrations
3. Test RLS policies with different users
4. Set up Edge Functions for webhooks and cron jobs
5. Configure storage buckets for file uploads

For more details, see:
- [SUPABASE.md](./SUPABASE.md) - Authentication and database usage
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Deploying to production
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues

---

## Convex Backend

For Convex setup and usage, see the dedicated guide: **[CONVEX.md](./CONVEX.md)**

Key differences from Supabase:
- **Schema**: Defined in TypeScript (`convex/schema.ts`)
- **Auth**: Uses `@convex-dev/auth` with `authTables` spread
- **Queries**: Reactive hooks (`useQuery`, `useMutation`)
- **Real-time**: Built-in - all queries are automatically reactive
- **Functions**: Server functions in `convex/*.ts`

### Security helpers

Convex has no database-level RLS, so security is enforced at the function boundary. The helpers in `convex/lib/security.ts` are the canonical pattern — call one of them at the top of every query and mutation that touches user data.

| Helper | What it does |
|--------|--------------|
| `requireAuth(ctx)` | Throws `UNAUTHENTICATED` if not signed in. Returns the userId. |
| `requireOwnership(ctx, table, id, userId, ownerField?)` | Throws if the document doesn't belong to `userId`. |
| `requireRole(ctx, userId, allowedRoles[])` | Throws `FORBIDDEN` if the user's `role` field isn't in the list. |
| `requireAdmin(ctx)` | Shorthand for `requireAuth` + `requireRole(["admin"])`. Use this for any role-changing or destructive mutation. |

Example — `setUserRole` from `convex/users.ts`:

```ts
export const setUserRole = mutation({
  args: { userId: v.id("users"), role: v.union(v.literal("user"), v.literal("admin"), v.literal("moderator")) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    await ctx.db.patch(args.userId, { role: args.role })
  },
})
```

The real implementation also includes a **last-admin lockout guard**: it refuses to demote the only remaining admin, which would leave the system unable to grant roles to anyone ever again. Copy that guard whenever a mutation can change a privileged role.

---

## `backend.db` is Supabase-only

`backend.db` is Supabase-only. Calling it on Convex throws. For Convex queries and mutations, use `useQuery` / `useMutation` from `convex/react` with the generated API.

The Convex implementation of `backend.db.{query,get,insert,update,delete,upsert,rpc}` throws this error at runtime when real Convex credentials are configured:

```
backend.db is Supabase-only. On Convex, import generated client from 'convex/_generated/api' and use useQuery/useMutation directly. See vibe/BACKEND.md for the pattern.
```

Mock mode (no Convex credentials) keeps the in-memory CRUD shims so local dev and tests still work.

### Convex query pattern

```tsx
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"

export function ProfileScreen({ userId }: { userId: string }) {
  const profile = useQuery(api.profiles.get, { userId })
  const updateProfile = useMutation(api.profiles.update)

  if (profile === undefined) return null // loading
  return <Text onPress={() => updateProfile({ userId, name: "New" })}>{profile.name}</Text>
}
```

`useQuery` is reactive — the component re-renders automatically when the underlying data changes. No manual refetch needed.

### Realtime hooks on Convex

`useRealtimeMessages`, `useRealtimePresence`, and friends are built on top of `backend.db` and Supabase's Postgres Changes channel. Because `backend.db` throws on Convex, these hooks are **no-op stubs** when `EXPO_PUBLIC_BACKEND_PROVIDER=convex`.

For Convex realtime, just use `useQuery` from the generated API directly. Every Convex query is reactive by default — there is no separate "realtime" surface to subscribe to. See [CONVEX.md](./CONVEX.md) for examples of chat and presence patterns implemented as plain queries and mutations.
