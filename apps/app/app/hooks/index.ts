/**
 * Hooks Index
 *
 * This is the main entry point for all hooks. Import from here for most use cases.
 *
 * ## Auth Hook
 *
 * ```tsx
 * import { useAuth, useUser, useAuthState } from "@/hooks"
 *
 * function MyScreen() {
 *   const { isAuthenticated, user, signIn, signOut, signInWithMagicLink, verifyOtp } = useAuth()
 *   // ... your component
 * }
 * ```
 *
 * `useAuth()` is the ONLY auth hook you need. It works with both Supabase and Convex backends.
 *
 * ## Convex Data Hooks (if using Convex backend)
 *
 * ```tsx
 * import { useQuery, useMutation } from "@/hooks"
 * import { api } from "@convex/_generated/api"
 *
 * const users = useQuery(api.users.list)  // Reactive!
 * const updateUser = useMutation(api.users.update)
 * ```
 *
 * ## Real-time Hooks
 *
 * ```tsx
 * import { useRealtimeMessages, useRealtimePresence } from "@/hooks"
 * ```
 */

// ============================================================================
// Auth Hooks - THE hooks to use in screens
// ============================================================================

export {
  // Main unified auth hook
  useAuth,
  // Lightweight helpers
  useUser,
  useAuthState,
  // Types
  type AppUser,
  type AppAuthState,
  type AppAuthActions,
  type ProfileUpdateData,
  // Deprecated aliases (for migration)
  useAppAuth,
  useAppUser,
  useAppAuthState,
} from "./useAppAuth"

// ============================================================================
// Real-time Hooks
// ============================================================================

export { useRealtimeMessages } from "./useRealtimeMessages"
export { useRealtimePresence } from "./useRealtimePresence"
export { useRealtimeSubscription } from "./useRealtimeSubscription"

// ============================================================================
// Utility Hooks
// ============================================================================

export { useAnalytics } from "./useAnalytics"
export { useDeepLinking } from "./useDeepLinking"
export { usePressableGesture } from "./usePressableGesture"
export { useEmailVerificationPolling } from "./useEmailVerificationPolling"
export { useWidgetData } from "./useWidgetData"

// ============================================================================
// Query Hooks (React Query)
// ============================================================================

export { queryClient } from "./queries/queryClient"
export { queryKeys } from "./queries/queryKeys"
export { useChart, chartKeys } from "./queries/useChart"
export { useGeocodeSearch, geocodeKeys } from "./queries/useGeocodeSearch"

// ============================================================================
// Convex Data Hooks (only needed if using Convex backend)
// ============================================================================

export {
  useQuery,
  useMutation,
  useAction,
  useConvex,
  Authenticated,
  Unauthenticated,
  AuthLoading,
} from "./convex"
