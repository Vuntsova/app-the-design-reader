/**
 * Auth Store Selectors
 *
 * Standalone selector functions for derived auth state.
 * Usage: const isAuth = useAuthStore(selectIsAuthenticated)
 */

import type { AuthState } from "../auth/authTypes"

/** Check if user is authenticated */
export const selectIsAuthenticated = (state: AuthState) => state.isAuthenticated

/** Get current user */
export const selectUser = (state: AuthState) => state.user

/** Get user email */
export const selectUserEmail = (state: AuthState) => state.user?.email

/** Get user ID */
export const selectUserId = (state: AuthState) => state.user?.id

/** Check if onboarding is completed */
export const selectHasCompletedOnboarding = (state: AuthState) => state.hasCompletedOnboarding

/** Check if auth is loading */
export const selectAuthLoading = (state: AuthState) => state.loading

/**
 * Selects multiple auth state fields. Returns a new object each call,
 * so use with useShallow to prevent unnecessary re-renders:
 *
 * ```ts
 * import { useShallow } from "zustand/react/shallow"
 * const authState = useAuthStore(useShallow(selectAuthState))
 * ```
 *
 * Or prefer individual selectors (selectIsAuthenticated, selectUser, etc.)
 * when you only need one or two fields.
 */
export const selectAuthState = (state: AuthState) => ({
  user: state.user,
  session: state.session,
  isAuthenticated: state.isAuthenticated,
  loading: state.loading,
  hasCompletedOnboarding: state.hasCompletedOnboarding,
})
