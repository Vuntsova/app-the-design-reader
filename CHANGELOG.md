# Changelog

All notable changes to Shipnative will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **`yarn setup` Convex path: `OnboardingScreen.tsx` left dangling imports**: `setup.ts` deleted `services/preferencesSync.ts` and `types/supabase.ts` for the Convex track but never rewrote `screens/OnboardingScreen.tsx`, which imports `syncGoalPreference` and the `OnboardingGoal` type from those files. Added a transformer that drops the `preferencesSync` import, inlines the `OnboardingGoal` union, and replaces the `syncGoalPreference(...)` call with a `logger.debug` placeholder (Convex projects sync goals via mutations).

## [1.0.0-rc13] - 2026-05-05

A broad code-quality pass across the boilerplate. Backend security tightened, demo screens polished, a handful of subtle effects and animations rewritten to the idiomatic patterns. No breaking changes for consumers — public store/hook signatures stay the same.

### Security

- **OAuth redirect allow-list**: `convex/auth.ts` `redirect` callback now falls back to the `shipnative://` default for any URL outside the dev-scheme allow-list AND the `SITE_URL` env var. Removes the "return `redirectTo` as-is" branch that the placeholder comment hinted at.
- **OAuth CSRF state validation unified**: `screens/AuthCallbackScreen.tsx` runs a shared `consumeOAuthState` prologue before either provider branch. The Convex social-auth hook (`hooks/convex/useConvexSocialAuth.ts`) now calls `createOAuthState()` before redirecting and `clearOAuthState()` on cancel/catch — same behavior the Supabase path already had.
- **Private user prefs off the world-readable `profiles` table**: New migration `20260505000000_move_private_prefs_off_profiles.sql` moves `dark_mode_enabled`, `notifications_enabled`, `push_notifications_enabled`, `email_notifications_enabled`, `has_completed_onboarding`, and `onboarding_completed_at` onto the RLS-locked `user_preferences` table, with backfill and column drops. `profiles` keeps `display_name`, `bio`, and `avatar_url` for public discovery. Application code (`services/preferencesSync.ts`, both `auth/authHelpers.ts` variants) now reads/writes through `user_preferences`.
- **Convex `widgets.getData` argument tightening**: Switched the `table` argument from `v.string()` to `v.union(v.literal(...))`, dropped the unused `filters: v.any()`, added an exhaustive `never`-checked default. Every case still scopes by userId.
- **`deleteAccount` cascade**: `convex/users.ts` now deletes related rows in `profiles`, `posts`, `comments`, `notifications`, `files`, `presence`, and `pushTokens` (each via `withIndex`, in parallel) before removing the user document. Closes the GDPR-relevant orphan-data gap.
- **OAuth callback log redaction**: `convex/auth.ts` informational `console.log` calls (URL, code, state) are now gated on `NODE_ENV === "development"`. The root `/` debug route in `convex/http.ts` is dev-only too.
- **Rate limiter device-scoped key**: `utils/rateLimiter.ts` keys signin attempts on `installId:email` instead of just `email`, so a sweep across emails on one device can't lock out the rightful owner of any of them. Install ID is read from `expo-application` with an MMKV-cached fallback.

### Backend

- **`filterByOwner` uses indexes**: `convex/lib/security.ts` helper now takes an `indexName` argument and runs `withIndex(indexName, q => q.eq(ownerField, userId))` instead of a full-table `.filter()` scan.
- **New `convex/posts.ts`**: First-class `list` / `create` / `remove` mutations and queries used by the demo screen, mirroring the security patterns from `convex/users.ts` (`requireAuth`, `withIndex("by_authorId")`, `requireOwnership`).

### Improved

- **`DataDemoScreen` polish**: Both demo screens compile cleanly without `as any` escape hatches and are fully translatable. The Supabase variant types its client via `SupabaseDatabase["public"]["Tables"]["posts"]` (added a `posts` row type to `apps/app/app/types/supabase.ts`). The Convex variant imports `api.posts.list/create/remove` directly. Convex variant also memoizes its row component (`PostListItem` + `useCallback`) to match the Supabase sibling. Every literal string is replaced with `tx`/`headingTx`/`contentTx`/`buttonTx`/`placeholderTx` props pointing at a new `dataDemoScreen` namespace; keys added across all seven locales.
- **`OnboardingScreen` goal step actually captures input**: The three goal rows now toggle a `selectedGoal` state instead of all firing `handleNext`. A single Continue button — disabled until a goal is picked — persists via the new `syncGoalPreference` helper before advancing. Selected row gets a primary border + check icon, `accessibilityRole="radio"`.
- **`HomeScreen` notification toggle now persists**: `togglePush()` was called without a `userId` from HomeScreen, so the new preference was never written to the backend (only saved to MMKV). Refactored the store to read `userId` from `useAuthStore.getState()` itself; all callers (`HomeScreen`, both `ProfileScreen` variants) now just call `togglePush()` with no argument.
- **`HomeScreen` real stat values**: The placeholder `12 Streak`, `85% Completed`, `4.8 Rating` cards now show real signals from existing stores — `unreadCount` and total `notifications.length` from `useNotificationStore`, plus `Pro`/`Free` from `useSubscriptionStore`. New i18n keys: `homeScreen.statUnread`, `statPlan`, `statInbox`, `planPro`, `planFree`.
- **`Progress` indeterminate animation**: Rewritten to the idiomatic Reanimated pattern — `withRepeat(withTiming(...), -1, false)` instead of a JS `setInterval` re-issuing `withTiming` every cycle. Adds `cancelAnimation` cleanup so the worklet stops on unmount.
- **`useEmailVerificationPolling` effect deps**: Polling interval no longer tears down and recreates on every successful poll. Effect deps are `[isEmailConfirmed, user?.id]`; `initialize` is captured via a stable ref.
- **`EmailVerificationScreen` sign-out race**: `handleBackToLogin` now `await`s `signOut()` before navigating, so AppNavigator can't re-route the user back to email-verify mid-flight.
- **`subscriptionStore` circular-import workaround removed**: Replaced the runtime `require("./auth")` and `as unknown as SubscriptionService` cast with a direct ES import. `revenueCat` is now explicitly typed as `SubscriptionService` at its export site, so type drift surfaces at compile time.
- **`services/supabase.ts` AppState listener cleanup**: Mirrors the pattern from `services/backend/supabase/client.ts` — listener stored in a module variable and removed before re-registering. New `destroySupabaseAuthAutoRefresh()` export for tests / env-switch flows.
- **MMKV storage hook split by platform**: `utils/storage/index.native.ts` + `utils/storage/index.web.ts` replace the single conditionally-hooked `index.ts`. No more `eslint-disable react-hooks/rules-of-hooks`. Public surface unchanged; Metro picks the right file by extension.
- **Theme tokens replace hardcoded numerics** on `HomeScreen` (icon-box sizes, tab-bar padding) and `EmailVerificationScreen` (icon-circle radius).

### Tooling

- **`setup.ts` exits non-zero on prereq failure** in non-interactive mode. CI runs that should hard-fail no longer "succeed" silently.

## [1.0.0-rc12] - 2026-05-04

### Fixed

- **CI lint failures**: Resolved 11 ESLint errors blocking `lint:check` in `apps/app` — `import/order` violations in `app.tsx`, `hooks/useAuth.ts`, and `services/preferencesSync.ts`, plus `prettier/prettier` formatting in `hooks/useRealtimeMessages.ts`, `screens/AuthCallbackScreen.tsx`, and `screens/PaywallScreen.tsx`.

## [1.0.0-rc11] - 2026-04-28

### Security

- **Push token hijack prevention**: `convex/pushTokens.ts` `register` now refuses to re-bind a token that's still actively held by another user. Device handoff still works (when the previous owner logs out, `deactivateAll` marks the row inactive and the new owner can claim it), but an attacker who somehow learned an active user's token can't claim it to intercept password-reset / MFA pushes.
- **`getActiveTokensForUser` admin gate**: `convex/pushTokens.ts` query now calls `requireAdmin(ctx)`. Previously any authenticated user could enumerate another user's device tokens.
- **`broadcast` requires auth**: `convex/realtime.ts` `broadcast` now uses `requireAuth` instead of `getAuthUserId`, so unauthenticated callers can no longer publish events to channels.
- **Subscription trust boundary documented**: `apps/app/app/stores/subscriptionStore.ts` now carries a header explaining that the persisted `isPro` flag is a UX cache only — server-side functions must verify entitlement against RevenueCat or a webhook-synced server table. Canonical reference added in `vibe/MONETIZATION.md` under "Trust Boundary".
- **Widget HTTP error log redaction**: `convex/http.ts` widget endpoints now log only `errorName` + `errorCode` instead of the raw error object, preventing upstream API customer IDs / query details from leaking via server logs.
- **Sentry user PII in dev logs**: `apps/app/app/services/sentry.ts` no longer falls back to `user.email` when logging the user context — only the opaque `user.id` is logged.
- **OAuth state TTL + atomic consumption**: `apps/app/app/utils/oauthState.ts` now enforces a 10-minute TTL on stored state values and reads them atomically (read-and-clear) to prevent TOCTOU replay.
- **`requireAdmin` helper**: New `requireAdmin(ctx)` in `convex/lib/security.ts`. Any role-changing or destructive Convex mutation must call it first. `setUserRole` in `convex/users.ts` is the canonical example, including a last-admin lockout guard.
- **`profiles` world-readable warning**: Added an explicit warning block in `supabase/schema.sql` documenting that `USING (true)` lets anonymous users read every row, with a list of fields that must never live on `profiles`.
- **`private_profiles` example migration**: New migration `supabase/migrations/20260428000000_add_private_profiles_example.sql` shows the canonical owner-only sibling table for PII (email, phone, billing).

### Backend

- **`backend.db` is Supabase-only**: The Convex implementation now throws a clear error pointing customers at `useQuery` from `convex/_generated/api`. Mock-mode CRUD shims still work with no credentials.
- **Realtime hooks no-op on Convex**: `useRealtimeMessages`, `useRealtimePresence`, and `useRealtimeSubscription` are stubs when `EXPO_PUBLIC_BACKEND_PROVIDER=convex` — Convex's `useQuery` is already reactive, so there's nothing to bridge.

### Hygiene

- **`clearPendingSyncs()` on logout**: The auth store cancels in-flight preference syncs on sign-out, preventing MMKV writes from one session leaking into the next user's session.
- **Convex auth comment block**: Added a header in `convex/auth.ts` documenting that token verification is delegated to `convexAuth({ providers })` and warning extenders not to add custom token-trust logic.

### Docs

- **Patches README** (`patches/README.md`): Documents `@bittingz+expo-widgets+3.0.2.patch` and how to add or remove patches.
- **Error handling** (`vibe/ERROR_HANDLING.md`): New file explaining what `ErrorBoundary` catches (render errors only) and pointing customers at Sentry for async/event handler coverage.
- **AGENTS.md**: Added MMKV call-site references, OAuth state TTL note, `requireAdmin` pointer, `private_profiles` pattern, `clearPendingSyncs` on logout, and the corrected `backend.db` description.
- **vibe/BACKEND.md**: Mirrored the world-readable warning on the inline `profiles` example, replaced the broken `metadata->>'role'` role-based access pattern with a real `role text` column, added a "Storing private user data" subsection, added a Convex "Security helpers" subsection with a `setUserRole` example, and noted the realtime hooks no-op on Convex.
- **mintlify_docs**: Updated `core-features/backend.mdx` with the `private_profiles` pattern and `realtime.mdx` with a Convex-uses-`useQuery` callout.

## [1.0.0-rc10] - March 2026

### Fixed

- **OAuth CSRF bypass**: Callback now requires a valid `state` parameter — omitting it no longer skips CSRF verification
- **Memory leak in realtime messages**: Typing timeout cleanup no longer holds stale references across re-renders
- **Rules of Hooks violation**: `useMemo` in OnboardingScreen moved out of conditional block to prevent runtime crashes
- **Translation keys stripped in production**: `loginScreen` and `errors` keys were inside `@demo remove-block` — moved to production scope
- **Sentry init timing**: Moved before app startup so early initialization errors are actually captured
- **iOS password autofill**: Confirm password field no longer triggers a second strong-password suggestion
- **Env var reading**: Uses `??` instead of `||` so falsy values like `"0"` are no longer silently dropped
- **Convex auth sync**: No longer creates a fake user with `id: "pending"` — stays in loading state until real user document exists
- **Preference sync errors**: Fire-and-forget syncs now report failures to Sentry instead of silently swallowing
- **Duplicate i18n init**: Removed redundant async initialization — single synchronous init at module load
- **Email verification polling**: Bare catch blocks now log warnings instead of silently swallowing errors

### Improved

- **Root ErrorBoundary**: Unhandled errors now show a recovery screen instead of a white page
- **Zustand auth selectors**: Converted to proper selector functions for correct memoization
- **Realtime presence stability**: `customData` changes compared by value (JSON serialization), not by reference
- **Rate limiter**: Fails open on internal errors (client-side defense-in-depth) with full error logging
- **Certificate pinning**: Misconfiguration now throws in production instead of logging silently
- **OAuth state**: Atomic read-and-clear consumption prevents TOCTOU race conditions
- **API timeout**: Configurable via `EXPO_PUBLIC_API_TIMEOUT` environment variable
- **Full i18n coverage**: WelcomeScreen, LoginScreen, and PaywallScreen hardcoded strings replaced with translation keys
- **ComponentShowcaseScreen**: Callbacks wrapped in `useCallback` to prevent unnecessary re-renders of memoized children
- **ConvexAuthSync**: Replaced unsafe `as unknown as User` casts with explicit mapping functions
- **Stable `updated_at`**: Uses Convex `_creationTime` instead of `new Date()` on every sync cycle

### Added

- **AuthErrorCode type**: Typed error codes (`invalid_credentials`, `email_not_confirmed`, etc.) and `createAuthError` helper
- **Logger.trace()**: New trace level for granular debug output below the debug level
- **Web storage fallback warning**: Logs once when falling back from sessionStorage to localStorage

## [Unreleased]

### Improved

- **Setup Wizard UX**: Redesigned service selection flow to reduce friction
  - Users now select all desired services upfront using a multi-select checkbox interface
  - Removed the repetitive "Skip remaining services?" prompt after each service
  - Only selected services are configured, making the setup process faster and less annoying
  - Services can still be added later by running `yarn setup` again

- **Pre-flight Checks for Dev Commands**: Added automatic validation before running dev commands
  - `yarn dev`, `yarn app:dev`, `yarn app:web`, `yarn app:start`, `yarn android`, `yarn ios` now check prerequisites
  - Warns users with clear error messages if `yarn install` or `yarn setup` haven't been run
  - Prevents cryptic errors from missing dependencies or configuration

### Fixed

- **Logic + Performance Hardening (Audit pass)**:
  - Fixed duplicate RevenueCat subscription listeners by cleaning up old listeners before re-initialization and adding explicit store cleanup
  - Lazy-loaded Sentry SDK during initialization to prevent module-load side effects and Jest open-handle warnings
  - Removed render-phase state updates in `Screen` auto preset to avoid rerender churn
  - Added timer/animation cleanup in paywall, email/OTP verification, and loading screen flows to prevent unmount leaks
  - Reduced unnecessary rerenders by switching key auth/profile/home subscriptions to selector-based Zustand usage
  - Fixed async `act` usage in subscription integration tests

- **Setup Wizard BackendProvider Cleanup**: Fixed "Property 'ConvexProviderWrapper' doesn't exist" error when using Supabase
  - **Issue:** After running `yarn setup` and selecting Supabase as backend, the app would crash with a render error
  - **Root Cause:** The setup script removed the `ConvexProviderWrapper` function definition but didn't remove the JSX usage of `<ConvexProviderWrapper>` in the return statement
  - **Solution:** Updated setup script to also skip `<ConvexProviderWrapper>` and `</ConvexProviderWrapper>` JSX lines, and removed misleading comments about "both providers"

- **Git Tracking of .yarn/install-state.gz**: Removed `.yarn/install-state.gz` from git tracking
  - File was already in `.gitignore` but was previously committed
  - No longer appears in git status or requires user action during commits

- **EAS Build Yarn 4.x Compatibility**: Fixed EAS Build failures caused by Yarn 4.x + corepack conflicts
  - **Issue:** EAS Build couldn't properly handle Yarn 4.x because it's distributed via corepack, not npm. Enabling `corepack: true` caused EEXIST errors when EAS also tried to install yarn via npm.
  - **Root Cause:** Yarn 4.x is not available on npm registry - it's only distributed through corepack. EAS's package manager installation logic conflicts with corepack's shims.
  - **Solution:** Bundled Yarn 4.9.1 directly in `.yarn/releases/yarn-4.9.1.cjs` with `yarnPath` configuration in `.yarnrc.yml`. This makes builds fully self-contained and works with any CI system.
  - EAS now uses the bundled yarn automatically without needing corepack or npm installation
  - Added `node: "20.19.0"` to `eas.json` production profile for consistent Node version

- **Vercel Web Deployment Environment Variables**: Fixed environment variables not being accessible in Expo web builds deployed to Vercel
  - **Issue:** Builds failed with "Missing required environment variables: supabaseUrl, supabasePublishableKey"
  - **Root Cause:** Metro doesn't inline `process.env.EXPO_PUBLIC_*` for web builds; the fallback to `Constants.expoConfig.extra` wasn't populated
  - **Solution:** Added `extra` section to `app.config.ts` that passes all `EXPO_PUBLIC_*` variables through to `Constants.expoConfig.extra`
  - All environment variables (Supabase, Convex, RevenueCat, PostHog, Sentry, OAuth, feature flags) are now properly accessible on Vercel deployments

### Documentation

- **Android Java Version Troubleshooting**: Added documentation for Java 25 incompatibility
  - Java 25 is too new for React Native's Gradle plugin; users need Java 17 (LTS)
  - The cryptic error `> 25.0.1` is the Java version, not a React Native version
  - Added to both `vibe/TROUBLESHOOTING.md` and `mintlify_docs/docs/troubleshooting.mdx`
  - Includes installation instructions via Homebrew (`temurin@17`)

### Added

- **Screen Creation Guidelines**: Added comprehensive screen layout patterns
  - `AGENTS.md` - Quick reference and patterns for choosing layout components
  - `vibe/SCREEN_TEMPLATES.md` - Detailed documentation with component APIs, patterns, and decision tree
  - Documented `Screen` and `Container` components with full prop tables and examples
  - Clear guidance on when to use `AuthScreenLayout`, `OnboardingScreenLayout`, `Screen`, or `Container`

- **Supabase Migrations Support**: Added proper migration infrastructure for version-controlled database schema changes
  - Created `supabase/migrations/` directory with initial schema migration (`20260122101738_initial_schema.sql`)
  - Added comprehensive migration guide at `supabase/migrations/README.md` with:
    - How to create and apply migrations (CLI and manual methods)
    - Migration best practices (idempotency, RLS, indexes, rollback strategies)
    - Common migration patterns and troubleshooting
  - Added troubleshooting guide at `supabase/TROUBLESHOOTING.md` covering:
    - Profile 404 errors after signup (expected behavior and solutions)
    - Wrong localhost port configuration (redirect URLs)
    - TypeScript configuration issues
    - Migration conflicts and RLS policy debugging
  - Updated internal developer docs:
    - `AGENTS.md` - Migration best practices and examples for AI-assisted development
    - `vibe/SUPABASE.md` - Migration setup instructions and troubleshooting section
  - Updated user-facing docs (mintlify):
    - `docs/core-features/backend.mdx` - Migration workflow and best practices
    - `docs/getting-started/marketing-page.mdx` - Migration option for waitlist table setup
    - `docs/troubleshooting.mdx` - Supabase-specific troubleshooting section

### Fixed

- **Screen Layout Inconsistencies**: Standardized DataDemoScreen to use `Screen` component
  - `DataDemoScreen.supabase.tsx` - Replaced manual `SafeAreaView` + `View` with `Screen` component
  - `DataDemoScreen.convex.tsx` - Replaced manual `SafeAreaView` + `View` with `Screen` component
  - Both versions now use consistent layout pattern with proper safe area handling
  - Simplified code by removing manual safe area calculations and web-specific styles

- **TypeScript Configuration for React Native**: Fixed conflicts between DOM/Node types and React Native's type definitions
  - Removed `"dom"` from `lib` array in `tsconfig.json` (React Native provides its own web-like APIs)
  - Removed `"node"` from `types` array to prevent `require` type conflicts
  - Removed `typeRoots` configuration (TypeScript discovers types automatically)
  - Fixes errors: `TS6200: Definitions conflict` and `TS2403: require must be Require`

- **i18n Translation Key Format**: Clarified in AGENTS.md that colon notation (`screenName:keyName`) is required for translation keys, not dot notation. Updated all documentation examples to use colon notation consistently to prevent confusion

- **Setup Script Compatibility**: Added symlink for `tsconfig.setup.json` in `apps/app` directory to fix setup script execution errors
- **Web Platform Compatibility**: Updated react-native-worklets web shim from version 0.6.0 to 0.7.1 to resolve Reanimated 4.2.1 compatibility issues on web platform
- **Auth Hook Provider Error**: Fixed `useAuth()` hook crashing when using Supabase backend due to missing Convex provider. Both providers are now always present to satisfy React's rules of hooks
- **Convex Package Dependencies**: Made Convex provider imports conditional to allow Supabase-only users to build without installing Convex packages (`convex`, `@convex-dev/auth`)
  - `BackendProvider` now uses dynamic `require()` for Convex providers only when `EXPO_PUBLIC_BACKEND_PROVIDER=convex`
  - Removed Convex exports from `providers/index.ts` to prevent eager loading
  - Users can now run the app with Supabase without having Convex packages installed

### Documentation

- **Added Upgrading Guide**: New documentation explaining how to pull updates from the Shipnative repository
  - Customer-facing guide at `docs/getting-started/upgrading.mdx`
  - Technical reference at `vibe/UPGRADING.md`
  - Covers git merge, cherry-pick, and manual copy methods
  - Includes conflict resolution strategies and post-upgrade checklist

### Security

- **Removed private keys from client-side environment variables**: `EXPO_PUBLIC_*` variables are bundled into the app and visible to users
  - Removed `EXPO_PUBLIC_APPLE_PRIVATE_KEY` and `EXPO_PUBLIC_APPLE_KEY_ID` - configure in Supabase Dashboard (Auth → Providers → Apple) or Convex environment variables
  - Removed `EXPO_PUBLIC_FCM_SERVER_KEY` - deprecated by Firebase; use FCM HTTP v1 API with service account authentication server-side
  - Updated setup wizard to no longer prompt for these sensitive values
  - Fixed `writeEnvFileWithComments` to properly quote multi-line values in `.env` files

### Changed - Simplified Backend DX

- **Renamed `useAppAuth()` to `useAuth()`**: Clearer naming for the unified auth hook
  - `useAuth()` is now THE hook to use in screens (imports from `@/hooks`)
  - `useAppAuth()` still works as a deprecated alias
  - Helper hooks renamed: `useAppUser()` → `useUser()`, `useAppAuthState()` → `useAuthState()`
  - Old names remain as deprecated aliases for backwards compatibility

- **Native Hooks as First-Class Escape Hatches**:
  - Supabase: `import { useSupabaseAuth } from '@/hooks/supabase'`
  - Convex: `import { useQuery, useMutation, useConvexAuth } from '@/hooks/convex'`
  - Clear documentation on when to use unified vs native hooks

- **Deprecated `backend.db.query()` for Convex**:
  - Added clear warnings that this abstraction doesn't match Convex's reactive paradigm
  - Documentation now recommends native `useQuery()` for Convex data fetching
  - Still works in mock mode for development

- **Setup Wizard: Remove Unused Backend Code**:
  - After selecting a backend, setup now offers to remove the unused provider's code
  - Removes `services/backend/{unused}/`, `hooks/{unused}/`, and related folders
  - Creates backups before removal
  - Simplifies codebase for developers who pick one backend

- **Auth Store Reorganization**:
  - Restructured auth store into backend-specific directories (`stores/auth/supabase/`, `stores/auth/convex/`)
  - Shared types and constants remain at `stores/auth/authTypes.ts` and `stores/auth/authConstants.ts`
  - Import path unchanged: `import { useAuthStore } from '@/stores/auth'`
  - Setup wizard now removes unused backend's auth directory automatically

- **New Documentation**: Added `vibe/BACKEND_PATTERNS.md`
  - Clear guidance on when to use unified vs native APIs
  - Data fetching patterns for each provider
  - Security patterns (RLS vs function guards)
  - Migration considerations between providers

### Added - DataDemoScreen Template

- **Provider-Specific Data Fetching Examples**:
  - `DataDemoScreen.supabase.tsx` - React Query + Supabase SDK pattern with optimistic updates
  - `DataDemoScreen.convex.tsx` - Reactive queries with auto-updates (no manual refetching)
  - Conditional export in `DataDemoScreen.tsx` loads correct version based on backend
  - Added to navigation: `navigation.navigate('DataDemo')` from any authenticated screen
- **Complete Working Examples**: Both screens demonstrate:
  - Data fetching (list posts)
  - Creating records (new posts)
  - Deleting records (with ownership check)
  - Loading states and error handling
  - The key paradigm differences between Supabase and Convex

### Added - Unified Auth Hook (Backend-Agnostic)
- **Enhanced `useAuth()` Hook**: Now the PRIMARY auth hook for all screens and components
  - Full `AppUser` interface that normalizes user data across Supabase and Convex
  - `updateProfile()` action for profile updates (works with both backends)
  - `completeOnboarding()` action for onboarding state
  - Unified state: `user`, `userId`, `isAuthenticated`, `isLoading`, `isEmailVerified`, `hasCompletedOnboarding`
  - All auth actions: `signIn`, `signUp`, `signOut`, `signInWithGoogle`, `signInWithApple`, `resetPassword`
- **Migrated All Screens to `useAuth()`**: Screens no longer use backend-specific hooks directly
  - ProfileScreen, HomeScreen, LoginScreen, RegisterScreen, OnboardingScreen, ForgotPasswordScreen
  - EditProfileModal now uses `updateProfile()` instead of direct Supabase calls
  - OTPVerificationScreen uses unified auth actions
- **Backend-Agnostic Account Deletion**: `DeleteAccountModal` now works with both backends
  - Supabase: Uses Edge Function with fallback to direct API deletion
  - Convex: Uses `api.users.deleteAccount` mutation
  - Automatically detects backend and uses appropriate deletion method
- **Backend-Agnostic Preferences & Onboarding**:
  - `preferencesSync.ts` gracefully skips sync when using Convex (uses mutations instead)
  - `authHelpers.ts` conditionally syncs onboarding status based on backend
  - Dark theme, notifications, and push tokens all work with both backends
  - Supabase: Uses `profiles` table and `push_tokens` table
  - Convex: Uses `users.preferences` object and `pushTokens` table via mutations
- **Conditional Service Imports**: Services now use lazy imports for backend-specific code
  - `preferencesSync.ts` - Skips Supabase calls when using Convex
  - `accountDeletion.ts` - Only imports Supabase when needed
  - `authHelpers.ts` - Conditionally imports Supabase for onboarding sync
  - Enables proper code splitting and prevents errors when using Convex

### Added - Convex Social Sign-In
- **Full Convex OAuth Implementation**: Complete social sign-in support for Convex Auth
  - `useConvexSocialAuth` hook for Google, Apple, and GitHub OAuth
  - Native Google Sign-In integration on iOS/Android (falls back to OAuth)
  - Proper in-app browser OAuth flow via `expo-web-browser`
  - Automatic OAuth callback handling with code extraction
  - Error handling distinguishes user cancellation from actual failures
- **Modular Convex Auth Hooks**: Separated auth functionality for better DX
  - `useConvexSocialAuth` - Social providers (Google, Apple, GitHub)
  - `useConvexPasswordAuth` - Email/password authentication
  - `useConvexMagicLink` - OTP/magic link authentication
- **Unified useAuth Hook**: Full Convex implementation (was previously stub)
  - Works identically to Supabase `useAuth` hook
  - Same interface: `signIn`, `signUp`, `signInWithGoogle`, `signInWithApple`, etc.
  - Automatic backend detection based on `EXPO_PUBLIC_BACKEND_PROVIDER`
- **Updated AuthCallbackScreen**: Now handles both Supabase and Convex OAuth callbacks

### Fixed
- **Convex Auth Provider**: Fixed `ResendOTP` provider (doesn't exist) → Use `Email` provider with custom Resend integration
- **Convex Realtime**: Fixed TypeScript errors in `realtime.ts` for presence auto-join and broadcast sender nullability
- **Convex Dependencies**: Added `convex`, `@convex-dev/auth`, and `@auth/core` to both root and app workspace
- **Setup Wizard yarn.lock Regeneration**: Fixed "Package not found in project" error after renaming app
  - Root cause: `yarn.lock` contained old package name references after `package.json` was updated
  - Setup wizard now automatically runs `yarn install` after renaming to regenerate workspace references
  - Prevents errors like `Internal Error: Package for myapp@workspace:apps/app not found`
- **Deep Link URLs Auto-Update**: Redirect URLs now automatically use your app's scheme
  - Previously: Redirect URLs stayed as `shipnative://verify-email` even after renaming
  - Now: If you set scheme to `myapp`, URLs become `myapp://verify-email` automatically
  - Affects `EXPO_PUBLIC_EMAIL_REDIRECT_URL` and `EXPO_PUBLIC_PASSWORD_RESET_REDIRECT_URL`
- **Expo Widgets Patch Application**: Fixed `@bittingz/expo-widgets` Logger conflict patch not being applied in monorepo setup
  - Root cause: `patch-package` was only configured in `apps/app/` but dependencies are hoisted to root `node_modules/`
  - Added `patch-package` to root `devDependencies` and `postinstall` script to root `package.json`
  - Patches in `/patches/` directory now apply correctly during `yarn install` at root level
  - Fixes iOS build error: `missing argument for parameter 'logHandlers' in call`

### Added - Dual Backend Support (Supabase & Convex)
- **Convex Native Integration**: First-class Convex support with native providers and hooks
  - `ConvexProvider` with `ConvexAuthProvider` from `@convex-dev/auth/react`
  - Platform-aware secure storage (Keychain/SecureStore for mobile, encrypted localStorage for web)
  - Uses `authTables` spread in schema for proper auth table definitions
  - Native hooks: `useConvexAuth`, `useConvexUser`, `useConvexAuthState`
  - Full OAuth support via `expo-web-browser` and `expo-auth-session`
- **Supabase Native Hooks**: Consistent hook API matching Convex patterns
  - Native hooks: `useSupabaseAuth`, `useSupabaseUser`, `useSupabaseAuthState`
  - Full OAuth support for Google and Apple Sign-In
- **Unified Auth Hook**: Backend-agnostic `useAuth()` hook
  - Automatically selects correct backend based on configuration
  - Provides common interface (`AppAuthState`, `AppAuthActions`) for both backends
  - Re-exports all native hooks for convenience
- **Backend Provider Selection**: Choose backend at setup time or via environment variable
  - `EXPO_PUBLIC_BACKEND_PROVIDER=supabase|convex`
  - Dynamic imports prevent bundling unused backend code
- **New Documentation**: Added `vibe/CONVEX.md` for Convex-specific guidance

### Changed - Backend Architecture
- **Convex Schema**: Now uses `authTables` spread from `@convex-dev/auth/server` instead of manual auth table definitions
- **BackendProvider**: Simplified to use new native providers with dynamic imports
- **Hook Organization**: Auth hooks reorganized into backend-specific directories (`hooks/convex/`, `hooks/supabase/`)

### Fixed - App Store Compliance
- **iOS Privacy Manifest**: Added proper data collection declarations
  - Declares `NSPrivacyCollectedDataTypeProductInteraction` for PostHog analytics
  - Declares `NSPrivacyCollectedDataTypeCrashData` for Sentry error tracking
  - Both marked as not linked to user and not used for tracking
  - Purposes: Analytics and App Functionality
  - Complies with iOS 17+ privacy requirements (App Review Guideline 5.1.1)
- **Android Permissions**: Removed `SYSTEM_ALERT_WINDOW` from production builds
  - Permission now debug-only (for React Native dev overlay)
  - Already properly isolated in `android/app/src/debug/AndroidManifest.xml`
  - Prevents unnecessary permission request in production

### Changed - Unistyles Migration
- **Single Theme System**: Migrated entire boilerplate to use Unistyles exclusively
  - Removed dual theme system (old custom theme + Unistyles)
  - All components now use `StyleSheet.create((theme) => ({...}))`
  - Dark mode detection via `UnistylesRuntime.themeName === "dark"`
  - Theme switching via `UnistylesRuntime.setTheme()`
  - Theme context simplified to persistence layer only
- **Components Migrated**: Header, Screen, DatePicker, Toggle, Switch, Checkbox, Radio
- **Navigators Migrated**: AppNavigator, MainTabNavigator
- **Screens Migrated**: ProfileScreen, ComponentShowcaseScreen
- **Breaking Changes**:
  - Removed `useAppTheme()` hook - use `useUnistyles()` instead
  - Removed `themed()` wrapper function - use styles directly
  - Removed `ThemedStyle` type - use `StyleSheet.create()` instead
  - Removed `setThemeContextOverride()` - use `UnistylesRuntime.setTheme()` instead
- **Native Date/Time Pickers**: Replaced custom modal calendar with platform-native pickers
  - iOS: Native spinner picker
  - Android: Material Design picker
  - Web: HTML5 input fallback
  - Better UX with system-native controls

### Added - Subscription Enhancements
- **Lifecycle Event Tracking**: Automatic detection and tracking of subscription events
  - Events: `trial_started`, `trial_converted`, `subscription_renewed`, `subscription_cancelled`, `billing_issue`, etc.
  - `addLifecycleListener()` method in subscription store
  - Automatic event detection on state changes with logging
- **Promotional Offers Support**: Full support for free trials and introductory pricing from RevenueCat
  - Automatic extraction of trial periods (e.g., "7 days free")
  - Intro pricing display (e.g., "$0.99 for first month")
  - Enhanced package data with `freeTrialPeriod`, `introPriceString`, `introPricePeriod` fields
  - Support for both mobile (react-native-purchases) and web (@revenuecat/purchases-js) SDKs
- **Price Localization Helpers**: New utility functions in `utils/subscriptionHelpers.ts`
  - `formatLocalizedPrice()` - Currency/locale formatting with Intl.NumberFormat
  - `calculateSavings()` - Percentage savings calculator
  - `getMonthlyEquivalent()` - Annual to monthly price conversion
  - `getPromotionalOfferText()` - Automatic promo copy generation
  - `formatExpirationStatus()` - Relative date formatting (e.g., "Renews in 5 days")
  - `getDaysRemaining()`, `isExpiringWithin()`, `isInGracePeriod()` - Status helpers
- **Mock RevenueCat Updates**: Realistic promotional offers for testing
  - Monthly: 7-day free trial + $9.99/month
  - Annual: 14-day free trial + $49.99 intro year + $99.99/year
- **Developer Tools**: Mock subscription toggle in Profile screen (dev mode only)
  - Toggle Pro on/off for testing in simulator
  - Shows "(Mock)" badge when using mock RevenueCat

### Documentation
- Added `vibe/SUBSCRIPTION_ADVANCED.md` - Comprehensive guide with examples for lifecycle events, promotional offers, and price localization
- Updated `mintlify_docs/docs/core-features/payments.mdx` - Added sections on new features with code examples
- Updated `boilerplate/AGENTS.md` - Added subscription helper function references
- Updated `boilerplate/vibe/MONETIZATION.md` - Enhanced setup and testing guide

### Changed
- **Paywall & Pricing Redesign** - Complete overhaul for higher conversion:
  - **Clear Pricing Anchors**: Annual plans show yearly price with monthly breakdown (e.g., "$69.99/year ≈ $5.83/month")
  - **Value Delta**: Added prominent benefit stack (Unlimited projects, Priority support, Advanced analytics, No watermarks)
  - **Outcome-Driven CTAs**: "Unlock Pro" for annual, "Choose Monthly" for monthly (instead of generic "Subscribe Now")
  - **Visual Hierarchy**: Annual plan gets 3px border, subtle scale transform, enhanced shadow, and "Save 40%" badge
  - **Risk Reversal**: Added "Cancel anytime • Secure App Store checkout" messaging
  - **Better Spacing**: Increased card padding (28px), larger price typography (44px), more generous gaps between elements
  - **Professional Icons**: Replaced emojis with Ionicons throughout (gift-outline for free, sparkles for pro, checkmark-circle for features)
  - Removed confusing "month" billing for annual plans
  - Monthly plan has intentionally weaker visual weight (outline button, lower contrast)

### Planned
- Stripe/PayPal add-ons alongside RevenueCat
- Offline-first data patterns and caching presets

## [1.0.0-rc8] - 2026-01-06

### Added
- **Push Token Backend Sync**: Automatic sync of Expo push tokens to Supabase `push_tokens` table:
  - Device info capture (device ID, name, platform)
  - Token activation/deactivation on logout
  - Fire-and-forget pattern for non-blocking sync
  - TypeScript types for push_tokens table in `types/supabase.ts`
- **Integration Tests**: Comprehensive test suites for core flows:
  - `notificationFlow.test.tsx`: Permission requests, token registration, notification management, badges
  - `subscriptionFlow.test.tsx`: Initialization, package fetching, purchases, restores, pro status

### Changed
- **Logger Consolidation**: Converted ~25 console.log/warn/error calls to use Logger utility across:
  - Store files (subscriptionStore, notificationStore)
  - Screen components (OnboardingScreen, PaywallScreen, EditProfileModal)
  - Service files (accountDeletion, languageSwitcher, hapticsCapability)
  - Navigation utilities and auth hooks

### Developer Experience
- Better debugging with structured logging and sensitive data redaction
- Test coverage for notification and subscription flows
- Type-safe push token database operations

## [1.0.0-rc7] - 2026-01-06

### Added
- **DatePicker Component**: Full-featured date and time picker with:
  - Calendar view with month navigation
  - Time picker with hour/minute selection
  - Support for date-only, time-only, or datetime modes
  - Min/max date constraints
  - i18n support with translation keys
  - Dark mode support
- **FilePicker Component**: File selection component with:
  - Image picker (camera roll) integration via `expo-image-picker`
  - Document picker integration via `expo-document-picker`
  - File type filtering (image, document, or any)
  - Multiple file selection with max file limit
  - File size validation
  - Image preview for selected files
  - Compact mode for inline display
- **Chart Components**: SVG-based data visualization:
  - `LineChart`: Multi-series line charts with smooth curves, area fills, and legend
  - `BarChart`: Vertical and horizontal bar charts with animated bars
  - `PieChart`: Pie and donut charts with percentage labels and legend
  - All charts support theming, animation, and responsive sizing

### Dependencies
- Added `expo-image-picker` (^17.0.10) for image selection
- Added `expo-document-picker` (^14.0.8) for document selection

## [1.0.0-rc6] - 2026-01-06

### Added
- **Supabase Realtime Hooks**: Ready-to-use hooks for common realtime patterns:
  - `useRealtimeMessages`: Full-featured chat with typing indicators, message CRUD, and connection status
  - `useRealtimePresence`: Track online users with status (online/away/busy) and custom presence data
  - `useRealtimeSubscription`: Generic hook for subscribing to any table changes
  - `useActivityFeed`: Helper for activity feed subscriptions
- **Realtime Types**: TypeScript types for messages, activities, presence, and subscriptions (`types/realtime.ts`)
- **GitHub Actions CI/CD Templates**:
  - `deploy.yml`: Production deployments for web (Vercel), iOS (EAS + App Store), Android (EAS + Play Store)
  - `preview.yml`: PR preview deployments with web URL and mobile QR code
  - Manual workflow dispatch for selective deployments
  - Build artifact uploads when Vercel isn't configured
- **Database Schemas**: SQL schemas for messages and activities tables with RLS policies

### Documentation
- **Realtime Guide**: Comprehensive documentation in `vibe/SUPABASE.md` with usage examples and database setup
- **CI/CD Guide**: New Mintlify docs page for GitHub Actions workflows (`deployment/ci-cd.mdx`)
- **Realtime Docs**: New Mintlify docs page for realtime features (`core-features/realtime.mdx`)
- **AGENTS.md**: Updated directory map with hooks, types, and CI/CD references

### Changed
- Expanded `vibe/SUPABASE.md` with full realtime hooks documentation and SQL schemas

## [1.0.0-rc5] - 2026-01-04

### Added
- **Cross-Device Preferences Sync**: Theme + notification settings now sync to the Supabase `profiles` table.
- **Dark Mode Sync**: `dark_mode_enabled` persists across devices and sessions.
- **Push Notifications Sync**: `push_notifications_enabled` is synced to the database.
- **Automatic Preference Restore**: User preferences are fetched and applied on login.

### Fixed
- **Edit Profile**: Save button no longer hangs due to `updateUser` deadlock.
- **Password Reset**: Added timeout handling to prevent hanging on `updateUser` calls.
- **Auth State**: Removed `USER_UPDATED` from events triggering `getUser()` to avoid deadlocks.

### Changed
- **Optimistic Updates**: Profile edits now use instant UI updates.
- **Fire-and-Forget**: Server updates run in the background while UI responds immediately.
- **Better UX**: Profile changes appear instantly without waiting for server confirmation.
- **Preferences Service**: New `preferencesSync.ts` service handles all preference database operations.

## [1.0.0-rc4] - 2026-01-04

### Added
- **Google Sign-In (Native)**: Switched native Google auth to ID token exchange using `@react-native-google-signin/google-signin`.
- **iOS URL Scheme Automation**: Auto-registers the Google iOS URL scheme from `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` in `app.config.ts`.
- **Reliable Sessions**: Supabase auth persists via SecureStore on iOS/Android.
- **GDPR Account Deletion**: Secure edge function + SQL helper for user deletion.
- **RevenueCat Integration**: Optional subscriber data deletion on account delete.
- **PostHog Integration**: Optional user + events deletion on account delete.
- **Node 20 Tooling**: Added Volta pinning for Node 20 + Yarn 4.
- **Widget Patch**: `@bittingz/expo-widgets` log fix via patch-package.

### Changed
- **Safer Defaults**: Google client secret is configured in Supabase (not the app).
- **Docs Simplification**: Social login steps now point to official Supabase guidance.
- **Graceful Degradation**: Third-party deletions skip if services aren't configured.
- **Auth Resilience**: Better invalid refresh token handling and sign-out behavior.
- **Upgrade Safety**: Added a guide + AI prompt for merging boilerplate updates.

### Migration Notes
- Pull the latest boilerplate changes and run `yarn install`.
- Install `@react-native-google-signin/google-signin` (if upgrading from older versions).
- Add `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` to `apps/app/.env` (keep `EXPO_PUBLIC_GOOGLE_CLIENT_ID`).
- Rebuild the dev client so the Info.plist URL scheme is updated.
- Deploy the account deletion edge function: `npx supabase functions deploy delete-user --no-verify-jwt`

## [1.0.0-rc2] - 2025-12-27

This update introduces the **AGENTS.md Standard**, a significant step forward in AI-assisted development of Shipnative. It improves context locality and reduces redundancy for AI agents.

### Added
- **AI Context**: Full adoption of the **AGENTS.md Standard**.
- **Nested Discovery**: Explicit instructions for agents to discover localized `AGENTS.md` files in `apps/app`, `landing_page`, and `mintlify_docs`.
- **Claude Integration**: Updated `CLAUDE.md` with `@AGENTS.md` import syntax for Claude Code compatibility.

### Changed
- **Marketing**: Rebranded all "vibe folder" mentions to "AGENTS.md Standard" on the landing page and throughout the documentation.

## [1.0.0-rc1] - 2025-12-26

New update with many improvements and reliability fixes. It's recommended to use this new version of the boilerplate for future developments or pull these changes in if you've recently started!

### Added
- **Authentication**: Refactored `useAuth` to support the **PKCE flow** for OAuth logins.
- **In-App Social Login**: Integrated `expo-web-browser` for a seamless social login experience.
- **Diagnostics**: Smarter network error messages that suggest checking project status in the Supabase dashboard.
- **Styling**: Introduced a comprehensive Neutral/Slate palette across the entire design system.

### Changed
- **Navigation**: Finalized deep linking configuration in `App.tsx` for all core screens and tab routes.
- **Mock Mode**: Updated mock authentication to support code-to-session exchange simulation.

### Fixed
- **Subscriptions**: Implemented auto-reset and sync for `subscriptionStore` on auth state changes.
- **Hardened RLS**: Updated Supabase policies for `profiles` and `waitlist` tables for better security/privacy.
- **Linting**: Cleaned up code regressions and Prettier formatting across all repositories.

## [1.0.0-beta] - 2025-12-01

### Added
- Expo 54 starter app for **iOS, Android, and Web (Expo Web)**
- RevenueCat subscriptions for mobile + web billing with mock mode
- Supabase authentication + profiles with RLS-ready schema
- PostHog analytics + feature flags and Sentry error tracking
- Push notifications (Expo Notifications) with mock fallback
- Deep linking (universal/app links + custom scheme)
- Design system (Unistyles 3), dark mode, and 14+ reusable components
- Dev Dashboard/component showroom, auth and subscription playground
- CLI generators for screens, components, stores, queries, API routes
- AI-first docs (`vibe/` folder + `.cursorrules`) for coding assistants
- Web build pipeline (`yarn web:dev`, `yarn web:build`, `yarn web:preview`)
- Comprehensive docs (Supabase, Monetization, Analytics, Notifications, Deployment)

[Unreleased]: https://github.com/shipnativeapp/shipnative/compare/v1.0.0-beta...HEAD
[1.0.0-beta]: https://github.com/shipnativeapp/shipnative/releases/tag/v1.0.0-beta
