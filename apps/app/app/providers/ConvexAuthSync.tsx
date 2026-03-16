/**
 * ConvexAuthSync
 *
 * Syncs Convex auth state to the Zustand auth store.
 * This is needed because AppNavigator uses useAuthStore for auth state,
 * but Convex manages auth state separately via ConvexAuthProvider.
 *
 * This component should be rendered inside ConvexProvider and will
 * automatically sync auth state changes.
 */

import { useEffect, useRef } from "react"
import { useConvexAuth } from "convex/react"
import { useQuery } from "convex/react"

import { api } from "../../../../convex/_generated/api"
import { useAuthStore } from "../stores"
import type { User, Session } from "../types/auth"
import { logger } from "../utils/Logger"

/**
 * Maps a Convex user object to the app's User type (Supabase-compatible shape).
 * This avoids unsafe `as unknown as User` casts by explicitly building the object
 * with the required fields and using a single controlled cast at the boundary.
 */
function mapConvexUserToUser(convexUser: {
  _id: string
  _creationTime: number
  email?: string
  name?: string
  avatarUrl?: string
  emailVerificationTime?: number
}): User {
  return {
    id: convexUser._id,
    aud: "authenticated",
    email: convexUser.email,
    created_at: new Date(convexUser._creationTime).toISOString(),
    app_metadata: {
      provider: "convex",
      providers: ["convex"],
    },
    user_metadata: {
      name: convexUser.name,
      avatarUrl: convexUser.avatarUrl,
    },
    email_confirmed_at: convexUser.emailVerificationTime
      ? new Date(convexUser.emailVerificationTime).toISOString()
      : new Date().toISOString(),
    // Fields required by SupabaseUser but not relevant for Convex
    role: "",
    confirmed_at: undefined,
    last_sign_in_at: undefined,
    phone: undefined,
    phone_confirmed_at: undefined,
    identities: [],
    factors: [],
    updated_at: new Date(convexUser._creationTime).toISOString(),
    is_anonymous: false,
  } as User
}

/**
 * Creates a Convex-compatible Session object wrapping the given user.
 */
function createConvexSession(user: User): Session {
  return {
    access_token: "convex-managed",
    refresh_token: "convex-managed",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user,
  } as Session
}

/**
 * ConvexAuthSync - Syncs Convex auth state to Zustand auth store
 *
 * This component listens to Convex auth state changes and updates
 * the Zustand auth store accordingly. This allows the rest of the app
 * (especially AppNavigator) to use the same auth store interface
 * regardless of whether Supabase or Convex is the backend.
 */
export function ConvexAuthSync({ children }: { children: React.ReactNode }) {
  // Log when the component mounts
  if (__DEV__) {
    logger.debug("[ConvexAuthSync] Component rendering")
  }

  const { isAuthenticated, isLoading } = useConvexAuth()
  const convexUser = useQuery(api.users.me)
  const hasInitializedRef = useRef(false)

  if (__DEV__) {
    logger.debug("[ConvexAuthSync] Auth state", {
      isAuthenticated,
      isLoading,
      convexUserStatus:
        convexUser === undefined ? "loading" : convexUser === null ? "null" : "exists",
      hasUser: !!convexUser,
    })
  }

  useEffect(() => {
    // Skip if Convex is still loading initial auth state
    if (isLoading) {
      return
    }

    const setSession = useAuthStore.getState().setSession
    const setUser = useAuthStore.getState().setUser
    const setLoading = useAuthStore.getState().setLoading
    const setHasCompletedOnboarding = useAuthStore.getState().setHasCompletedOnboarding

    // Handle authenticated state
    if (isAuthenticated) {
      // convexUser is undefined when query is still loading
      // convexUser is null when query returned but no user found
      // convexUser is the user object when authenticated and user exists

      if (convexUser === undefined) {
        // Query still loading - keep auth store in loading state
        if (__DEV__) {
          logger.debug("[ConvexAuthSync] Authenticated but user query still loading")
        }
        setLoading(true)
        return
      }

      if (convexUser === null) {
        // User is authenticated but users.me returned null
        // This is a brief race condition where the Convex user document hasn't been created yet.
        // Keep loading state so downstream code doesn't try to use a nonexistent user.
        if (__DEV__) {
          logger.warn(
            "[ConvexAuthSync] Authenticated but users.me returned null - waiting for user document",
          )
        }

        setLoading(true)
        return
      }

      // User is authenticated and we have user data
      const user = mapConvexUserToUser(convexUser)

      // Create session-like object for compatibility
      const session = createConvexSession(user)

      if (__DEV__ && !hasInitializedRef.current) {
        logger.debug("[ConvexAuthSync] Syncing authenticated user to auth store", {
          userId: user.id,
          email: user.email,
        })
      }

      setSession(session)
      setUser(user)
      setLoading(false)

      // Sync onboarding status
      if (convexUser.hasCompletedOnboarding !== undefined) {
        void setHasCompletedOnboarding(convexUser.hasCompletedOnboarding)
      }

      hasInitializedRef.current = true
    } else {
      // User is not authenticated
      if (__DEV__ && hasInitializedRef.current) {
        logger.debug("[ConvexAuthSync] User signed out, clearing auth store")
      }

      setSession(null)
      setUser(null)
      setLoading(false)
      hasInitializedRef.current = true
    }
  }, [isAuthenticated, isLoading, convexUser])

  return <>{children}</>
}
