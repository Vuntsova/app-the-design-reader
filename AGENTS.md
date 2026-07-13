# AGENTS.md

> **This repo is being built into The Design Reader** — a premium Human Design
> mobile app on top of the Shipnative boilerplate. Product spec:
> [`apps/app/vibe/PROJECT.md`](./apps/app/vibe/PROJECT.md). Agent behavior
> rules: [`CLAUDE.md`](./CLAUDE.md). Phase gates: [`ROADMAP.md`](./ROADMAP.md).
> This AGENTS.md remains the source of truth for stack + coding conventions.

## Setup
```bash
yarn install          # Install dependencies
yarn setup            # Interactive wizard (configures .env, app.json)
yarn app:start        # Start Expo dev server
yarn app:ios          # Run on iOS simulator
yarn app:android      # Run on Android emulator
yarn app:web          # Run in browser
```

Make sure the code you write is compliant with App Store and play store policies.

## Tech Stack

### ALWAYS USE
- **Styling**: Unistyles 3.0 with `StyleSheet.create((theme) => ({...}))`
- **Navigation**: React Navigation (type-safe via `navigationTypes.ts`)
- **State**: Zustand (global) + React Query (server)
- **Forms**: React Hook Form + Zod
- **Backend**: Supabase OR Convex (choose one), RevenueCat, PostHog, Sentry

### Storage Decision Guide (MMKV vs Supabase)

**CRITICAL: Choose the right storage for each use case.**

| Use Case | Storage | Why |
|----------|---------|-----|
| User profile data | **Supabase** | Syncs across devices, needs RLS protection |
| User preferences (theme, language) | **Supabase** | Syncs across devices when user logs in elsewhere |
| Posts, messages, shared content | **Supabase** | Multi-user access, real-time updates |
| Friends lists, relationships | **Supabase** | Relational data with RLS |
| Auth tokens/sessions | **Supabase Auth** | Secure storage handled by SDK |
| Onboarding completion flag | **MMKV** (local cache) + **Supabase** (source of truth) | Fast UI + persistent sync |
| Subscription status cache | **MMKV** | RevenueCat is source of truth; MMKV is fast local cache |
| Temporary form state | **Zustand** (memory) | No persistence needed |
| Draft content before save | **MMKV** | Survives app restart, not synced |

**Decision Tree:**
```
Does data need to sync across user's devices?
  → YES → Use Supabase
  → NO → Continue...

Does data require authentication/authorization?
  → YES → Use Supabase (RLS)
  → NO → Continue...

Is it a cache of server data for fast UI?
  → YES → Use MMKV (with Supabase as source of truth)
  → NO → Continue...

Is it temporary/ephemeral local state?
  → YES → Use MMKV or Zustand (memory)
```

**NEVER store sensitive data (tokens, passwords, PII) in MMKV. Use Supabase Auth's secure storage.**

**MMKV usage in this repo:**
- `apps/app/app/utils/storage/index.ts` — the singleton `MMKV` instance (and `useMMKVString` hook with a web localStorage fallback). All other code goes through this module.
- `apps/app/app/stores/auth/authConstants.ts` and `apps/app/app/stores/auth/authStore.ts` — Zustand auth store persisted via the MMKV-backed `createJSONStorage` adapter (sensitive fields are stripped before write).
- `apps/app/app/stores/subscriptionStore.ts` — same pattern for the RevenueCat subscription cache.
- `apps/app/app/theme/context.tsx` — `useMMKVString` for the persisted theme scheme.

### Backend Choice
The boilerplate supports two backends with native-level integration:

| Backend | Best For | Auth | Database | Realtime |
|---------|----------|------|----------|----------|
| **Supabase** | SQL apps, PostgreSQL fans | Email, OAuth, Magic Link | PostgreSQL + RLS | Postgres Changes |
| **Convex** | TypeScript-first, reactive apps | Email, OAuth (Auth.js) | Document DB + Functions | Built-in reactivity |

Configure via `yarn setup` or set `EXPO_PUBLIC_BACKEND_PROVIDER=supabase|convex` in `.env`.

### Supabase Database Migrations

**ALWAYS use migrations when modifying the Supabase database schema.** Never edit `supabase/schema.sql` directly for changes.

#### Creating a New Migration

```bash
# Create a new migration file
supabase migration new add_todos_table

# This creates: supabase/migrations/YYYYMMDDHHMMSS_add_todos_table.sql
```

#### Migration Best Practices

1. **Use migrations for all schema changes** - Never edit `schema.sql` directly
2. **Always use `IF NOT EXISTS`** - Makes migrations idempotent (safe to run multiple times)
3. **Drop policies before recreating** - Prevents "already exists" errors
4. **Enable RLS on all user tables** - Security best practice
5. **Add indexes for foreign keys** - Performance optimization
6. **One migration per feature** - Easier to understand and rollback
7. **Never modify applied migrations** - Create new migrations for changes

Example migration:
```sql
-- Create table
CREATE TABLE IF NOT EXISTS public.todos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

-- Add policies
DROP POLICY IF EXISTS "Users can view own todos" ON public.todos;
CREATE POLICY "Users can view own todos"
    ON public.todos FOR SELECT
    USING (auth.uid() = user_id);

-- Add indexes
CREATE INDEX IF NOT EXISTS todos_user_id_idx ON public.todos(user_id);
```

See [supabase/migrations/README.md](../supabase/migrations/README.md) for detailed guide.

### NEVER USE
- NativeWind/Tailwind (use Unistyles)
- Expo Router (use React Navigation)
- Redux/MobX/Context API (use Zustand)
- Inline styles or hardcoded values (use theme)
- Hardcoded user-facing strings (use translation keys - see i18n section below)
- useEffect for data fetching (use React Query)

## Directory Map

| Need | Location |
|------|----------|
| Screens | `apps/app/app/screens/` |
| Components | `apps/app/app/components/` |
| Translations (i18n) | `apps/app/app/i18n/` (add keys to `en.ts`) |
| Charts | `apps/app/app/components/Charts/` |
| **Hooks (import from here)** | `apps/app/app/hooks/index.ts` |
| Convex Native Hooks | `apps/app/app/hooks/convex/` |
| Supabase Native Hooks | `apps/app/app/hooks/supabase/` |
| Stores (Zustand) | `apps/app/app/stores/` |
| Services | `apps/app/app/services/` |
| Types | `apps/app/app/types/` |
| Theme config | `apps/app/app/theme/unistyles.ts` |
| Navigation types | `apps/app/app/navigators/navigationTypes.ts` |
| Integration tests | `apps/app/app/__tests__/integration/` |
| Logger utility | `apps/app/app/utils/Logger.ts` |

## UI Components

### Form Inputs
- `TextField` - Text input with validation
- `DatePicker` - Native date/time pickers (iOS/Android/Web)
- `FilePicker` - Image and document uploads
- `Toggle`, `Switch`, `Checkbox`, `Radio` - Toggle controls

### Data Visualization
- `LineChart` - Multi-series line charts
- `BarChart` - Vertical/horizontal bar charts
- `PieChart` - Pie and donut charts
- `Progress` - Linear and circular progress

### Layout
- `Card`, `Container`, `Screen`, `Tabs`
- `Modal`, `Divider`, `Header`

### Feedback
- `Toast`, `Spinner`, `Skeleton`, `EmptyState`

### Business Components
- `PricingCard` - Subscription pricing display with features list (uses Ionicons for checkmarks)
- `SubscriptionStatus` - User subscription status display (uses Ionicons for plan icons)

## i18n / Translations

**ALWAYS use translation keys (`tx` props) instead of hardcoded strings for user-facing text.**

### Component Props Pattern
Most components support both direct text and translation keys:

```typescript
// ❌ WRONG - hardcoded strings
<EmptyState
  heading="No todos yet"
  content="Add your first todo to get started"
/>

// ✅ CORRECT - translation keys (MUST use colon notation)
<EmptyState
  headingTx="todoScreen:emptyHeading"
  contentTx="todoScreen:emptyContent"
/>

// ✅ With interpolation
<Text tx="welcomeScreen:greeting" txOptions={{ name: user.name }} />
```

### Props Available
| Component | Translation Props |
|-----------|-------------------|
| `Text` | `tx`, `txOptions` |
| `Button` | `tx`, `txOptions` |
| `EmptyState` | `headingTx`, `contentTx`, `buttonTx` (+ `*TxOptions`) |
| `Card` | `headingTx`, `contentTx`, `footerTx` (+ `*TxOptions`) |
| `TextField` | `labelTx`, `placeholderTx`, `errorTx`, `helperTx` |

### Adding New Translation Keys
1. Add keys to `apps/app/app/i18n/en.ts` (source of truth)
2. Use nested structure: `screenName: { keyName: "value" }`
3. **Key path syntax: MUST use colon notation `"screenName:keyName"`** (NOT dot notation)

```typescript
// In en.ts
const en = {
  todoScreen: {
    emptyHeading: "No todos yet",
    emptyContent: "Add your first todo to get started",
    addButton: "Add Todo",
  },
}
```

### Programmatic Access
```typescript
import { useTranslation } from "react-i18next"

const { t } = useTranslation()
const message = t("todoScreen:emptyHeading")  // Use colon notation
```

## Authentication

**Use `useAuth()` in screens** - it works with both Supabase and Convex:

```typescript
import { useAuth } from '@/hooks'

const {
  user,                    // Unified AppUser object
  isAuthenticated,
  isLoading,
  signIn, signUp, signOut,
  signInWithGoogle, signInWithApple,
  updateProfile,
} = useAuth()
```

**For provider-specific features, use native hooks:**

```typescript
// Supabase-specific (magic link, OTP, direct SDK)
import { useSupabaseAuth } from '@/hooks/supabase'

// Convex-specific (reactive queries, mutations)
import { useQuery, useMutation, useConvexAuth } from '@/hooks/convex'
import { api } from '@convex/_generated/api'

const users = useQuery(api.users.list)  // Reactive - auto-updates!
const updateUser = useMutation(api.users.update)
```

## Data Fetching by Provider

### Supabase (SQL-like, React Query)
```typescript
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'

const { data } = useQuery({
  queryKey: ['users'],
  queryFn: () => supabase.from('users').select('*')
})
```

### Convex (Reactive, TypeScript-native)
```typescript
import { useQuery, useMutation } from '@/hooks/convex'
import { api } from '@convex/_generated/api'

// Reactive - auto-updates when data changes!
const users = useQuery(api.users.list)
const createUser = useMutation(api.users.create)
```

> **Note**: `backend.db` is Supabase-only and throws on Convex. On Convex, use `useQuery` from `convex/_generated/api` directly. The mock-mode in-memory CRUD shim still works for local dev with no credentials.

### DataDemoScreen (Template)
See `screens/DataDemoScreen.supabase.tsx` or `screens/DataDemoScreen.convex.tsx` for complete working examples of data fetching with your chosen backend.

## Subscription Features

### Helper Functions (from `@/utils/subscriptionHelpers`)
- `formatLocalizedPrice()` - Format prices with proper currency/locale
- `calculateSavings()` - Calculate percentage savings between prices
- `getPromotionalOfferText()` - Generate promo copy (e.g., "7 days free, then $9.99/mo")
- `formatExpirationStatus()` - Relative expiration dates (e.g., "Renews in 5 days")
- `detectLifecycleEvent()` - Detect subscription state changes
- `getDaysRemaining()` - Calculate days until expiration

### Lifecycle Events
Track subscription events via `useSubscriptionStore().addLifecycleListener()`:
- `trial_started`, `trial_converted`, `trial_cancelled`
- `subscription_started`, `subscription_renewed`, `subscription_cancelled`
- `subscription_expired`, `subscription_restored`
- `billing_issue`

### Package Data
All packages include promotional pricing when configured in RevenueCat:
- `freeTrialPeriod` - e.g., "7 days"
- `introPriceString` - e.g., "$0.99"
- `introPricePeriod` - e.g., "1 month"

## Security

- OAuth state has a 10-minute TTL and is read-and-cleared atomically (see `apps/app/app/utils/oauthState.ts`).
- Use `requireAdmin(ctx)` from `convex/lib/security.ts` for any role-changing or destructive mutation. See `setUserRole` in `convex/users.ts` for the canonical pattern, including the last-admin lockout guard. Sibling helpers: `requireAuth`, `requireOwnership`, `requireRole`.
- The `profiles` table is world-readable by design (public discovery). For private user data, follow `supabase/migrations/20260428000000_add_private_profiles_example.sql` — a separate `private_profiles` table with `auth.uid() = user_id` policies. Never store email, phone, billing info, or PII on `profiles`.
- `clearPendingSyncs()` is called from the auth store on logout to cancel any in-flight preference syncs, so MMKV writes from a previous session can't leak into the next user's session.
- `ErrorBoundary` only catches React render errors — not async, event handler, or pre-mount crashes. Use Sentry for full coverage. See `vibe/ERROR_HANDLING.md`.
- Push tokens (`convex/pushTokens.ts`): `register` rejects re-binding a token already owned by another user, and `getActiveTokensForUser` is gated behind `requireAdmin`. Treat push tokens as device-scoped credentials.
- Realtime broadcast (`convex/realtime.ts`): `broadcast` requires authentication. Anonymous publishing is not allowed.
- Subscription gating: `useSubscriptionStore.isPro` is a UX cache, not security. Persisted MMKV state is editable on jailbroken devices. Server functions that unlock paid functionality must verify entitlement against RevenueCat or a webhook-synced server table — never against a client-supplied flag. See `vibe/MONETIZATION.md` → "Trust Boundary".
- Server-side error logs in `convex/http.ts` redact to `errorName` + `errorCode` to avoid leaking upstream customer IDs / query details into logs.

## Detailed Docs (in `vibe/`)

| Topic | File |
|-------|------|
| The Design Reader spec (HD canon, payload contract, tabs, v1 scope) | `apps/app/vibe/PROJECT.md` |
| Styling patterns | `apps/app/vibe/STYLE_GUIDE.md` |
| App architecture | `apps/app/vibe/ARCHITECTURE.md` |
| Screen templates | `apps/app/vibe/SCREEN_TEMPLATES.md` |
| Services & mocks | `vibe/SERVICES.md`, `vibe/MOCK_SERVICES.md` |
| Backend overview | `vibe/BACKEND.md` |
| Error handling (boundary scope, Sentry) | `vibe/ERROR_HANDLING.md` |
| Supabase (auth, database) | `vibe/SUPABASE.md` |
| Convex (auth, database) | `vibe/CONVEX.md` |
| Realtime (chat, presence) | `vibe/SUPABASE.md` (Realtime Hooks section) |
| Payments | `vibe/MONETIZATION.md` |
| Advanced subscriptions | `vibe/SUBSCRIPTION_ADVANCED.md` |
| CI/CD workflows | `.github/workflows/` |

## Platform Support
- iOS, Android, Web (via Expo Web)
- `apps/web/` is a separate marketing site using Tailwind (not Unistyles)

## Environment Variables

| File | Purpose |
|------|---------|
| `apps/app/.env` | Mobile app config (Expo loads this) |
| `apps/app/.env.example` | Template with all available variables |
| `apps/web/.env` | Marketing site config (Vite loads this) |
| Root `.env.local` | Shared/override config (NOT used by apps) |

**For mobile app**: Edit `apps/app/.env` or run `yarn setup` to configure interactively.

**For marketing site**: Edit `apps/web/.env`.

> Note: Root-level `.env.local` exists for scripts/tooling but is NOT automatically loaded by the apps. Each app reads its own `.env` file.

## Screen Creation

**ALWAYS use the correct layout component for consistency.** See `vibe/SCREEN_TEMPLATES.md` for detailed patterns and examples.

### Quick Guide

| Screen Type | Component |
|------------|-----------|
| Auth (Login, Register) | `<AuthScreenLayout>` |
| Onboarding | `<OnboardingScreenLayout>` |
| Standard app screen | `<Screen preset="scroll" safeAreaEdges={["top", "bottom"]}>` |
| Form screen | `<Container keyboardAvoiding safeAreaEdges={["top", "bottom"]}>` |

**Example patterns:**
```typescript
// Auth screens
<AuthScreenLayout titleTx="..." showCloseButton>

// App screens
<Screen preset="scroll" safeAreaEdges={["top", "bottom"]}>

// Forms
<Container preset="scroll" keyboardAvoiding safeAreaEdges={["top", "bottom"]}>
```

**DO NOT:**
- Mix layout patterns (some screens using `Screen`, others using manual `View`+`ScrollView`)
- Manually handle safe areas when component does it automatically
- Copy HomeScreen's manual layout pattern - use `Screen` or `Container` instead

## Rules
- Check `apps/app/app/components/` before creating new components
- Use theme values (`theme.colors.*`, `theme.spacing.*`) - never hardcode
- All components must support dark mode via semantic theme colors
- New feature docs go in `vibe/` or `docs/`, NOT root directory
- **ALWAYS follow screen creation guidelines above for consistency**
