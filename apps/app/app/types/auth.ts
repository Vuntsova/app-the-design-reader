/**
 * Platform-agnostic authentication types
 *
 * These types provide a unified interface for authentication services
 * across different platforms and providers (Supabase, etc.)
 */

import type {
  SignInWithPasswordCredentials,
  SignUpWithPasswordCredentials,
} from "@supabase/auth-js"
import type {
  AuthResponse as SupabaseAuthResponse,
  Session as SupabaseSession,
  User as SupabaseUser,
  UserAttributes,
} from "@supabase/supabase-js"

export type AuthProvider = "supabase" | "mock"

export type User = SupabaseUser
export type Session = SupabaseSession
export type AuthResponse = SupabaseAuthResponse

export type SignUpCredentials = SignUpWithPasswordCredentials
export type SignInCredentials = SignInWithPasswordCredentials

export interface ResetPasswordOptions {
  redirectTo?: string
}

export type UpdateUserAttributes = UserAttributes

export type AuthChangeEvent =
  | "SIGNED_IN"
  | "SIGNED_OUT"
  | "TOKEN_REFRESHED"
  | "USER_UPDATED"
  | "PASSWORD_RECOVERY"

/**
 * Specific error codes for auth operations
 */
export type AuthErrorCode =
  | "invalid_credentials"
  | "email_not_confirmed"
  | "user_not_found"
  | "network_error"
  | "rate_limit_exceeded"
  | "weak_password"
  | "email_already_in_use"
  | "unknown"

/**
 * Typed auth error with a discriminating code
 */
export interface AuthError extends Error {
  code: AuthErrorCode
}

/**
 * Helper to create a typed AuthError
 */
export function createAuthError(code: AuthErrorCode, message: string): AuthError {
  const error = new Error(message) as AuthError
  error.code = code
  return error
}

export interface AuthStateChangeCallback {
  (event: AuthChangeEvent, session: Session | null): void
}

export interface AuthService {
  provider: AuthProvider

  // Sign up
  signUp(credentials: SignUpCredentials): Promise<AuthResponse>

  // Sign in
  signInWithPassword(credentials: SignInCredentials): Promise<AuthResponse>

  // Sign out
  signOut(): Promise<{ error: Error | null }>

  // Session management
  getSession(): Promise<{ data: { session: Session | null }; error: Error | null }>
  getUser(): Promise<{ data: { user: User | null }; error: Error | null }>

  // Password reset
  resetPasswordForEmail(
    email: string,
    options?: ResetPasswordOptions,
  ): Promise<{
    data: Record<string, unknown> | null
    error: Error | null
  }>

  // Update user
  updateUser?(attributes: UpdateUserAttributes): Promise<AuthResponse>

  // Auth state changes
  onAuthStateChange(callback: AuthStateChangeCallback): {
    data: { subscription: { unsubscribe: () => void } }
  }
}

/**
 * Helper to check if user is authenticated
 */
export function isAuthenticated(session: Session | null): boolean {
  if (!session) return false

  // Check if session is expired
  if (session.expires_at && session.expires_at < Date.now() / 1000) {
    return false
  }

  return true
}

/**
 * Helper to get user from session
 */
export function getUserFromSession(session: Session | null): User | null {
  return session?.user || null
}

/**
 * Helper to check if user's email is confirmed
 */
export function isEmailConfirmed(user: User | null): boolean {
  if (!user) return false
  const provider = typeof user.app_metadata?.provider === "string" ? user.app_metadata.provider : ""
  const providers = Array.isArray(user.app_metadata?.providers) ? user.app_metadata.providers : []
  const identities = Array.isArray(user.identities) ? user.identities : []
  const hasOAuthProvider = provider !== "" && provider !== "email"
  const hasOAuthProviders = providers.some((entry) => entry && entry !== "email")
  const hasOAuthIdentity = identities.some((identity) => {
    const identityProvider = identity?.provider ?? ""
    return identityProvider !== "" && identityProvider !== "email"
  })
  if (hasOAuthProvider || hasOAuthProviders || hasOAuthIdentity) return true
  // Check both email_confirmed_at and confirmed_at (Supabase uses both)
  return !!(user.email_confirmed_at || user.confirmed_at)
}
