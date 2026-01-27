# ADR 003: State Management Approach

## Status
Accepted

## Context
The app uses Zustand for global state. As the app grows, we needed patterns to ensure state management remains maintainable, debuggable, and performant.

## Decision
We enhanced the Zustand implementation with:
1. **Middleware**: Added logging and error handling middleware
2. **Selectors**: Enforced use of memoized selectors for derived state
3. **Composition**: Split stores by domain (Auth, Subscription)
4. **Persistence**: Configured MMKV for fast LOCAL persistence (see Storage Guidelines below)

## Storage Guidelines: MMKV vs Supabase

**MMKV is for LOCAL device caching only. Supabase is for persistent user data.**

### When to Use Supabase (Database)
- **User data that syncs across devices** (profiles, preferences, settings)
- **Shared/relational data** (posts, messages, friends, comments)
- **Data requiring authentication** (protected by RLS policies)
- **Source of truth for user state** (onboarding completion, account status)

### When to Use MMKV (Local Cache)
- **Fast UI caching** of server data (reduces loading spinners)
- **Offline-first UI state** while waiting for sync
- **Non-sensitive local preferences** (last viewed tab, collapsed sections)
- **Draft content** before user saves to server

### What MMKV is Currently Used For
- `subscriptionStore`: Caches RevenueCat subscription status locally (RevenueCat is source of truth)
- `authStore`: Caches onboarding progress locally (Supabase `profiles` is source of truth)

### Never Use MMKV For
- ❌ Auth tokens or sessions (use Supabase Auth's secure storage)
- ❌ User profile data (use Supabase)
- ❌ User preferences that should sync (use Supabase)
- ❌ Any data that needs to persist across device changes

### Example: User Preferences
```typescript
// ❌ WRONG - Using MMKV for user preferences
const usePreferencesStore = create(
  persist(
    (set) => ({
      theme: 'light',
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'preferences', storage: mmkvStorage }
  )
)

// ✅ CORRECT - Using Supabase for user preferences
// Store in Supabase profiles table, sync on app load
const { data } = await supabase
  .from('profiles')
  .select('dark_mode_enabled')
  .eq('id', userId)
  .single()
```

## Consequences
### Positive
- Better debugging with state change logging
- Improved performance with selectors
- Consistent error handling in stores
- Type-safe state management
- Clear separation: MMKV for caching, Supabase for persistence

### Negative
- More boilerplate for selectors
- Learning curve for middleware pattern
- Must understand when to use each storage type
