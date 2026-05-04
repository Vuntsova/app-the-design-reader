/**
 * Universal Authentication Hook
 *
 * Provides a consistent authentication interface regardless of backend provider.
 * Automatically detects whether Supabase or Convex is being used and provides
 * the appropriate implementation.
 *
 * Usage:
 * ```typescript
 * const { user, signIn, signOut, isAuthenticated } = useAuth()
 * ```
 */

import { useState, useEffect, useCallback } from "react"
import { Platform } from "react-native"
import * as Linking from "expo-linking"

import { env, isConvex } from "../config/env"
import { clearPendingSyncs } from "../services/preferencesSync"
import { useAuthStore } from "../stores/auth"
import type {
  User,
  Session,
  SignUpCredentials,
  SignInCredentials,
  UpdateUserAttributes,
} from "../types/auth"
import { createAppUrl } from "../utils/appScheme"
import { logger } from "../utils/Logger"
import { clearOAuthState, consumeOAuthState, createOAuthState } from "../utils/oauthState"
import { isStorageDegraded } from "../utils/webStorageEncryption"

// OAuth state CSRF + TTL handling lives in `utils/oauthState.ts` so every
// auth code path (this hook, `hooks/supabase/useSupabaseAuth.ts`, the
// `AuthCallbackScreen`) gets the same guarantees.

// ============================================================================
// Web Browser Import (Platform-Specific)
// ============================================================================

const getWebBrowser = () => {
  if (Platform.OS === "web") {
    return null
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-web-browser")
  } catch {
    logger.warn("expo-web-browser not available, falling back to Linking")
    return null
  }
}

const WebBrowser = getWebBrowser()
if (WebBrowser?.maybeCompleteAuthSession) {
  WebBrowser.maybeCompleteAuthSession()
}

// ============================================================================
// Google Sign-In Module (Platform-Specific)
// ============================================================================

type GoogleSigninModule = {
  GoogleSignin: {
    configure: (options: { webClientId?: string; iosClientId?: string }) => void
    signIn: () => Promise<{ idToken?: string; data?: { idToken?: string } }>
    hasPlayServices?: () => Promise<void>
    getTokens?: () => Promise<{ idToken?: string; accessToken?: string }>
  }
  statusCodes?: Record<string, string>
}

let isGoogleSigninConfigured = false

const getGoogleSigninModule = (): GoogleSigninModule | null => {
  if (Platform.OS === "web") {
    return null
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@react-native-google-signin/google-signin") as GoogleSigninModule
  } catch (error) {
    if (__DEV__) {
      logger.warn("Google Sign-In library not available", { error })
    }
    return null
  }
}

// ============================================================================
// Types
// ============================================================================

export interface UseAuthReturn {
  // State
  user: User | null
  session: Session | null
  loading: boolean

  // Methods
  signUp: (credentials: SignUpCredentials) => Promise<{ error: Error | null }>
  signIn: (credentials: SignInCredentials) => Promise<{ error: Error | null }>
  signInWithGoogle: () => Promise<{ error: Error | null }>
  signInWithApple: () => Promise<{ error: Error | null }>
  signInWithMagicLink: (email: string, captchaToken?: string) => Promise<{ error: Error | null }>
  verifyOtp: (email: string, token: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<{ error: Error | null }>
  resetPassword: (email: string) => Promise<{ error: Error | null }>
  updateUser: (attributes: UpdateUserAttributes) => Promise<{ error: Error | null }>

  // Helpers
  isAuthenticated: boolean

  // Provider info
  provider: "supabase" | "convex"
}

// ============================================================================
// Supabase Implementation
// ============================================================================

function useSupabaseAuth(): UseAuthReturn {
  // Lazy import supabase to enable code splitting
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { supabase } = require("../services/supabase")

  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const waitForSession = useCallback(
    async (timeoutMs: number): Promise<Session | null> => {
      const start = Date.now()
      while (Date.now() - start < timeoutMs) {
        const { data } = await supabase.auth.getSession()
        if (data.session) return data.session
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
      return null
    },
    [supabase.auth],
  )

  // Initialize auth state
  useEffect(() => {
    // Surface degraded web storage mode (localStorage fallback) so callers
    // know tokens may persist across browser restarts on this device.
    if (Platform.OS === "web" && isStorageDegraded()) {
      logger.warn(
        "[useAuth] Web secure storage running in degraded mode (localStorage fallback). " +
          "Auth tokens will persist across browser restarts on this device.",
      )
    }

    // Get initial session
    supabase.auth
      .getSession()
      .then(({ data: { session } }: { data: { session: Session | null } }) => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
      })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [supabase.auth])

  const signUp = useCallback(
    async (credentials: SignUpCredentials) => {
      setLoading(true)
      const { error } = await supabase.auth.signUp(credentials)
      setLoading(false)
      return { error }
    },
    [supabase.auth],
  )

  const signIn = useCallback(
    async (credentials: SignInCredentials) => {
      setLoading(true)
      const { error } = await supabase.auth.signInWithPassword(credentials)
      setLoading(false)
      return { error }
    },
    [supabase.auth],
  )

  const signOut = useCallback(async () => {
    setLoading(true)
    // Drop any in-flight preference retries so they don't run under the
    // next signed-in user's session.
    clearPendingSyncs()
    const { error } = await supabase.auth.signOut({ scope: "local" })
    setLoading(false)
    return { error }
  }, [supabase.auth])

  const resetPassword = useCallback(
    async (email: string) => {
      setLoading(true)
      const { error } = await supabase.auth.resetPasswordForEmail(email)
      setLoading(false)
      return { error }
    },
    [supabase.auth],
  )

  const updateUser = useCallback(
    async (attributes: UpdateUserAttributes) => {
      setLoading(true)
      const { error } = await supabase.auth.updateUser(attributes)
      setLoading(false)
      return { error }
    },
    [supabase.auth],
  )

  const signInWithGoogle = useCallback(async () => {
    setLoading(true)
    try {
      if (Platform.OS !== "web") {
        const googleModule = getGoogleSigninModule()
        if (!googleModule?.GoogleSignin) {
          return { error: new Error("Google Sign-In is not available on this platform") }
        }

        if (!env.googleClientId) {
          return { error: new Error("Google client ID is missing") }
        }

        if (!isGoogleSigninConfigured) {
          googleModule.GoogleSignin.configure({
            webClientId: env.googleClientId,
            iosClientId: env.googleIosClientId,
          })
          isGoogleSigninConfigured = true
        }

        if (googleModule.GoogleSignin.hasPlayServices) {
          await googleModule.GoogleSignin.hasPlayServices()
        }

        let response
        try {
          response = await googleModule.GoogleSignin.signIn()
        } catch (signInError) {
          const errorMessage =
            signInError instanceof Error ? signInError.message : String(signInError)
          if (
            errorMessage.includes("cancel") ||
            errorMessage.includes("SIGN_IN_CANCELLED") ||
            errorMessage.includes("user cancelled") ||
            errorMessage.includes("getTokens requires a user")
          ) {
            return { error: new Error("OAuth flow cancelled") }
          }
          throw signInError
        }

        let idToken = response?.idToken ?? response?.data?.idToken ?? null
        let accessToken: string | null = null

        if (googleModule.GoogleSignin.getTokens) {
          try {
            const tokens = await googleModule.GoogleSignin.getTokens()
            idToken = tokens?.idToken ?? idToken
            accessToken = tokens?.accessToken ?? null
          } catch {
            return { error: new Error("OAuth flow cancelled") }
          }
        }

        if (!idToken) {
          return { error: new Error("Google ID token not returned") }
        }

        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: "google",
          token: idToken,
          ...(accessToken ? { access_token: accessToken } : {}),
        })

        if (error) {
          return { error }
        }

        if (data?.session) {
          setSession(data.session)
          setUser(data.session.user ?? null)
          useAuthStore.getState().setSession(data.session)
        }

        return { error: null }
      }

      let redirectTo: string | undefined

      if (Platform.OS === "web") {
        if (typeof window !== "undefined") {
          redirectTo = `${window.location.origin}/auth/callback`
        }
      } else {
        redirectTo = createAppUrl("auth/callback")
      }
      if (__DEV__) {
        logger.debug("[useAuth] Google OAuth redirectTo", { redirectTo })
      }
      const oauthState = createOAuthState()

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: { state: oauthState },
          // On web, allow Supabase to redirect the browser directly to Google
          // On mobile, we handle the redirect ourselves via WebBrowser
          skipBrowserRedirect: Platform.OS !== "web",
        },
      })

      if (error) {
        clearOAuthState()
        return { error }
      }

      // Web: Browser will redirect to Google, then back to /auth/callback
      // The AuthCallbackScreen will handle the token exchange
      // Mobile: Handle OAuth flow via in-app browser
      if (Platform.OS !== "web" && data?.url) {
        if (__DEV__) {
          logger.debug("[useAuth] Google OAuth URL received", { url: data.url })
        }
        if (WebBrowser) {
          const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)

          if (__DEV__) {
            // Do NOT log result.url: it may contain access_token / refresh_token
            // / authorization code in the fragment or query string.
            logger.debug("[useAuth] Google OAuth session result", {
              type: result.type,
              hasUrl: !!result.url,
            })
          }

          if (result.type === "success" && result.url) {
            let urlStr = result.url
            const getParam = (name: string) => {
              const regex = new RegExp(`[?&|#]${name}=([^&|#]*)`)
              const match = urlStr.match(regex)
              return match ? decodeURIComponent(match[1]) : null
            }

            const accessTokenParam = getParam("access_token")
            const refreshToken = getParam("refresh_token")
            const code = getParam("code")
            const state = getParam("state")
            // Drop the raw URL once tokens are extracted so it cannot leak into
            // later logs, error messages, or Sentry breadcrumbs.
            urlStr = ""

            if (__DEV__) {
              logger.debug("[useAuth] Google OAuth callback params", {
                hasAccessToken: !!accessTokenParam,
                hasRefreshToken: !!refreshToken,
                hasCode: !!code,
              })
            }

            if (!consumeOAuthState(state)) {
              return { error: new Error("Invalid OAuth callback state") }
            }

            if (code) {
              if (__DEV__) {
                try {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const authInternal = supabase.auth as any
                  const storageKey = authInternal?.storageKey
                  const verifierKey = storageKey ? `${storageKey}-code-verifier` : null
                  const storedVerifier = verifierKey
                    ? await authInternal?.storage?.getItem?.(verifierKey)
                    : null
                  logger.debug("[useAuth] Google code verifier check", {
                    storageKey: storageKey ?? null,
                    hasVerifier: !!storedVerifier,
                  })
                } catch (verifierError) {
                  logger.error(
                    "[useAuth] Google code verifier read failed",
                    {},
                    verifierError as Error,
                  )
                }
                logger.debug("[useAuth] Google exchanging code for session", {
                  codePrefix: code.slice(0, 8),
                })
              }
              // Race the exchange against a 3s timeout. If the exchange loses,
              // we fall through to waitForSession; the late-resolving exchange
              // must not overwrite session state set by the fallback path.
              let timedOut = false
              const exchangePromise = supabase.auth.exchangeCodeForSession(code)
              exchangePromise.catch(() => undefined)
              exchangePromise.then((late: unknown) => {
                if (timedOut) return
                // Loser-of-race noop: the awaited result below handles the win path.
                void late
              })
              const exchangeResult = await Promise.race([
                exchangePromise,
                new Promise<null>((resolve) =>
                  setTimeout(() => {
                    timedOut = true
                    resolve(null)
                  }, 3000),
                ),
              ])
              if (exchangeResult && "error" in exchangeResult && exchangeResult.error) {
                logger.error(
                  "[useAuth] Failed to exchange code for session",
                  { error: exchangeResult.error.message },
                  exchangeResult.error,
                )
                return { error: exchangeResult.error }
              }
              let nextSession =
                exchangeResult && "data" in exchangeResult ? exchangeResult.data?.session : null
              if (!nextSession) {
                nextSession = await waitForSession(10000)
              }
              if (nextSession) {
                const { data: refreshed } = await supabase.auth.getUser()
                if (refreshed.user) {
                  nextSession.user = refreshed.user
                }
                setSession(nextSession)
                setUser(nextSession.user)
                useAuthStore.getState().setSession(nextSession)
              }
            } else if (accessTokenParam && refreshToken) {
              const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                access_token: accessTokenParam,
                refresh_token: refreshToken,
              })
              if (sessionError) {
                return { error: sessionError }
              }
              if (sessionData?.session) {
                const { data: refreshed } = await supabase.auth.getUser()
                if (refreshed.user) {
                  sessionData.session.user = refreshed.user
                }
                useAuthStore.getState().setSession(sessionData.session)
              }
            }
          } else if (result.type === "cancel") {
            clearOAuthState()
            return { error: new Error("OAuth flow cancelled") }
          }
        } else {
          const canOpen = await Linking.canOpenURL(data.url)
          if (canOpen) {
            await Linking.openURL(data.url)
          } else {
            return { error: new Error("Unable to open OAuth URL") }
          }
        }
      }

      return { error: null }
    } catch (error) {
      clearOAuthState()
      const resolvedError = error instanceof Error ? error : new Error(String(error))
      if (resolvedError.name === "TimeoutError") {
        const { data: fallbackSession } = await supabase.auth.getSession()
        if (fallbackSession.session) {
          setSession(fallbackSession.session)
          setUser(fallbackSession.session.user)
          useAuthStore.getState().setSession(fallbackSession.session)
          return { error: null }
        }
      }
      logger.error(
        "[useAuth] Google OAuth flow failed",
        {
          name: resolvedError.name,
          message: resolvedError.message,
        },
        resolvedError,
      )
      return { error: error as Error }
    } finally {
      setLoading(false)
    }
  }, [supabase.auth, waitForSession])

  const signInWithApple = useCallback(async () => {
    setLoading(true)
    try {
      let redirectTo: string | undefined

      if (Platform.OS === "web") {
        if (typeof window !== "undefined") {
          redirectTo = `${window.location.origin}/auth/callback`
        }
      } else {
        redirectTo = createAppUrl("auth/callback")
      }
      if (__DEV__) {
        logger.debug("[useAuth] Apple OAuth redirectTo", { redirectTo })
      }
      const oauthState = createOAuthState()

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "apple",
        options: {
          redirectTo,
          queryParams: { state: oauthState },
          // On web, allow Supabase to redirect the browser directly to Apple
          // On mobile, we handle the redirect ourselves via WebBrowser
          skipBrowserRedirect: Platform.OS !== "web",
        },
      })

      if (error) {
        clearOAuthState()
        return { error }
      }

      // Web: Browser will redirect to Apple, then back to /auth/callback
      // The AuthCallbackScreen will handle the token exchange
      // Mobile: Handle OAuth flow via in-app browser
      if (Platform.OS !== "web" && data?.url) {
        if (__DEV__) {
          logger.debug("[useAuth] Apple OAuth URL received", { url: data.url })
        }
        if (WebBrowser) {
          const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)

          if (__DEV__) {
            // Do NOT log result.url: it may contain access_token / refresh_token
            // / authorization code in the fragment or query string.
            logger.debug("[useAuth] Apple OAuth session result", {
              type: result.type,
              hasUrl: !!result.url,
            })
          }

          if (result.type === "success" && result.url) {
            let urlStr = result.url
            const getParam = (name: string) => {
              const regex = new RegExp(`[?&|#]${name}=([^&|#]*)`)
              const match = urlStr.match(regex)
              return match ? decodeURIComponent(match[1]) : null
            }

            const accessTokenParam = getParam("access_token")
            const refreshToken = getParam("refresh_token")
            const code = getParam("code")
            const state = getParam("state")
            // Drop the raw URL once tokens are extracted so it cannot leak into
            // later logs, error messages, or Sentry breadcrumbs.
            urlStr = ""

            if (__DEV__) {
              logger.debug("[useAuth] Apple OAuth callback params", {
                hasAccessToken: !!accessTokenParam,
                hasRefreshToken: !!refreshToken,
                hasCode: !!code,
              })
            }

            if (!consumeOAuthState(state)) {
              return { error: new Error("Invalid OAuth callback state") }
            }

            if (code) {
              if (__DEV__) {
                logger.debug("[useAuth] Apple exchanging code for session", {
                  codePrefix: code.slice(0, 8),
                })
              }
              // Race the exchange against a 3s timeout. If the exchange loses,
              // we fall through to waitForSession; the late-resolving exchange
              // must not overwrite session state set by the fallback path.
              let timedOut = false
              const exchangePromise = supabase.auth.exchangeCodeForSession(code)
              exchangePromise.catch(() => undefined)
              exchangePromise.then((late: unknown) => {
                if (timedOut) return
                // Loser-of-race noop: the awaited result below handles the win path.
                void late
              })
              const exchangeResult = await Promise.race([
                exchangePromise,
                new Promise<null>((resolve) =>
                  setTimeout(() => {
                    timedOut = true
                    resolve(null)
                  }, 3000),
                ),
              ])
              if (exchangeResult && "error" in exchangeResult && exchangeResult.error) {
                logger.error(
                  "[useAuth] Failed to exchange code for session (Apple)",
                  { error: exchangeResult.error.message },
                  exchangeResult.error,
                )
                return { error: exchangeResult.error }
              }
              let nextSession =
                exchangeResult && "data" in exchangeResult ? exchangeResult.data?.session : null
              if (!nextSession) {
                nextSession = await waitForSession(10000)
              }
              if (nextSession) {
                const { data: refreshed } = await supabase.auth.getUser()
                if (refreshed.user) {
                  nextSession.user = refreshed.user
                }
                setSession(nextSession)
                setUser(nextSession.user)
                useAuthStore.getState().setSession(nextSession)
              }
            } else if (accessTokenParam && refreshToken) {
              const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                access_token: accessTokenParam,
                refresh_token: refreshToken,
              })
              if (sessionError) {
                return { error: sessionError }
              }
              if (sessionData?.session) {
                const { data: refreshed } = await supabase.auth.getUser()
                if (refreshed.user) {
                  sessionData.session.user = refreshed.user
                }
                useAuthStore.getState().setSession(sessionData.session)
              }
            }
          } else if (result.type === "cancel") {
            clearOAuthState()
            return { error: new Error("OAuth flow cancelled") }
          }
        } else {
          const canOpen = await Linking.canOpenURL(data.url)
          if (canOpen) {
            await Linking.openURL(data.url)
          } else {
            return { error: new Error("Unable to open OAuth URL") }
          }
        }
      }

      return { error: null }
    } catch (error) {
      clearOAuthState()
      const resolvedError = error instanceof Error ? error : new Error(String(error))
      if (resolvedError.name === "TimeoutError") {
        const { data: fallbackSession } = await supabase.auth.getSession()
        if (fallbackSession.session) {
          setSession(fallbackSession.session)
          setUser(fallbackSession.session.user)
          useAuthStore.getState().setSession(fallbackSession.session)
          return { error: null }
        }
      }
      logger.error(
        "[useAuth] Apple OAuth flow failed",
        {
          name: resolvedError.name,
          message: resolvedError.message,
        },
        resolvedError,
      )
      return { error: error as Error }
    } finally {
      setLoading(false)
    }
  }, [supabase.auth, waitForSession])

  const signInWithMagicLink = useCallback(
    async (email: string, captchaToken?: string) => {
      setLoading(true)
      try {
        // Generate proper redirect URL for magic link
        // On web: redirect to auth callback page
        // On mobile: no redirect needed (user enters OTP code manually)
        const emailRedirectTo =
          Platform.OS === "web" && typeof window !== "undefined"
            ? `${window.location.origin}/auth/callback`
            : undefined

        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo,
            ...(captchaToken ? { captchaToken } : {}),
          },
        })
        return { error }
      } finally {
        setLoading(false)
      }
    },
    [supabase.auth],
  )

  const verifyOtp = useCallback(
    async (email: string, token: string) => {
      setLoading(true)
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "email",
      })
      if (!error && data?.session) {
        const verifiedSession = data.session
        setSession(verifiedSession)
        setUser(verifiedSession?.user ?? null)
      }
      setLoading(false)
      return { error }
    },
    [supabase.auth],
  )

  return {
    user,
    session,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signInWithApple,
    signInWithMagicLink,
    verifyOtp,
    signOut,
    resetPassword,
    updateUser,
    isAuthenticated: !!session,
    provider: "supabase",
  }
}

// ============================================================================
// Convex Implementation
// ============================================================================

/**
 * Convex authentication hook.
 *
 * Provides full authentication functionality using Convex Auth with proper
 * OAuth handling for mobile (React Native) and web platforms.
 *
 * For more granular control, use these hooks directly:
 * - useConvexSocialAuth() - for Google, Apple, GitHub sign-in with mobile OAuth handling
 * - useConvexPasswordAuth() - for email/password authentication
 * - useConvexMagicLink() - for OTP/magic link authentication
 * - useConvexAuth() - for unified auth state and actions
 */
function useConvexAuthImpl(): UseAuthReturn {
  // If Convex is not the selected backend, return stub implementation
  // This prevents trying to call Convex hooks when ConvexProvider isn't in the tree
  if (!isConvex) {
    return {
      user: null,
      session: null,
      loading: false,
      signUp: async () => ({ error: new Error("Convex is not the selected backend") }),
      signIn: async () => ({ error: new Error("Convex is not the selected backend") }),
      signInWithGoogle: async () => ({ error: new Error("Convex is not the selected backend") }),
      signInWithApple: async () => ({ error: new Error("Convex is not the selected backend") }),
      signInWithMagicLink: async () => ({ error: new Error("Convex is not the selected backend") }),
      verifyOtp: async () => ({ error: new Error("Convex is not the selected backend") }),
      signOut: async () => ({ error: new Error("Convex is not the selected backend") }),
      resetPassword: async () => ({ error: new Error("Convex is not the selected backend") }),
      updateUser: async () => ({ error: new Error("Convex is not the selected backend") }),
      isAuthenticated: false,
      provider: "convex",
    }
  }

  // Import the modular Convex auth hooks
  // Using require to avoid hook rules violation (conditional hook calls)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const {
    useConvexAuth: useConvexAuthHook,
    useConvexSocialAuth,
    useConvexPasswordAuth,
    useConvexMagicLink,
  } = require("./convex")

  // Get auth state from Convex
  // Note: isConvex is a build-time constant, so these hooks are always called
  // in the same order during runtime (the early return above only triggers
  // when Convex is not configured, which is determined at build time)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const convexAuth = useConvexAuthHook()
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const socialAuth = useConvexSocialAuth()
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const passwordAuth = useConvexPasswordAuth()
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const magicLinkAuth = useConvexMagicLink()

  // Convert Convex user to our User type
  // Note: Convex users have a different shape than Supabase users
  // We create a compatible object with the essential fields
  const user: User | null = convexAuth.user
    ? ({
        id: convexAuth.user._id,
        email: convexAuth.user.email,
        created_at: new Date(convexAuth.user._creationTime).toISOString(),
        aud: "authenticated",
        app_metadata: {
          provider: "convex",
        },
        user_metadata: {
          name: convexAuth.user.name,
          avatarUrl: convexAuth.user.avatarUrl,
        },
        // Convex-specific fields
        email_confirmed_at: convexAuth.user.emailVerificationTime
          ? new Date(convexAuth.user.emailVerificationTime).toISOString()
          : undefined,
      } as User)
    : null

  // Create session-like object for compatibility
  // Convex manages tokens internally, so we provide a minimal session object
  const session: Session | null =
    convexAuth.isAuthenticated && user
      ? ({
          access_token: "convex-managed",
          refresh_token: "convex-managed",
          expires_in: 3600,
          token_type: "bearer",
          user,
        } as Session)
      : null

  // Combined loading state
  const loading =
    convexAuth.isLoading || socialAuth.loading || passwordAuth.loading || magicLinkAuth.loading

  // Sign up with email/password
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const signUp = useCallback(
    async (credentials: SignUpCredentials) => {
      // Handle both email and phone credentials (Supabase types)
      const email = "email" in credentials ? credentials.email : undefined
      const password = credentials.password
      const name =
        credentials.options?.data && "name" in credentials.options.data
          ? (credentials.options.data.name as string)
          : undefined

      if (!email) {
        return { error: new Error("Email is required for Convex sign up") }
      }

      const result = await passwordAuth.signUp({ email, password, name })
      return { error: result.error }
    },
    [passwordAuth],
  )

  // Sign in with email/password
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const signIn = useCallback(
    async (credentials: SignInCredentials) => {
      // Handle both email and phone credentials (Supabase types)
      const email = "email" in credentials ? credentials.email : undefined
      const password = credentials.password

      if (!email) {
        return { error: new Error("Email is required for Convex sign in") }
      }

      const result = await passwordAuth.signIn({ email, password })
      return { error: result.error }
    },
    [passwordAuth],
  )

  // Sign out
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const signOut = useCallback(async () => {
    // Drop any in-flight preference retries so they don't run under the
    // next signed-in user's session.
    clearPendingSyncs()
    const result = await passwordAuth.signOut()
    // Clear session from auth store
    useAuthStore.getState().setSession(null)
    return { error: result.error }
  }, [passwordAuth])

  // Sign in with Google (handles native + OAuth flow)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const signInWithGoogle = useCallback(async () => {
    const result = await socialAuth.signInWithGoogle()
    return { error: result.error }
  }, [socialAuth])

  // Sign in with Apple
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const signInWithApple = useCallback(async () => {
    const result = await socialAuth.signInWithApple()
    return { error: result.error }
  }, [socialAuth])

  // Sign in with magic link / OTP
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const signInWithMagicLink = useCallback(
    async (email: string, _captchaToken?: string) => {
      const result = await magicLinkAuth.sendMagicLink(email)
      return { error: result.error }
    },
    [magicLinkAuth],
  )

  // Verify OTP
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const verifyOtp = useCallback(
    async (email: string, token: string) => {
      const result = await magicLinkAuth.verifyOtp(email, token)
      return { error: result.error }
    },
    [magicLinkAuth],
  )

  // Reset password
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const resetPassword = useCallback(
    async (email: string) => {
      const result = await passwordAuth.resetPassword(email)
      return { error: result.error }
    },
    [passwordAuth],
  )

  // Update user
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const updateUser = useCallback(
    async (attributes: UpdateUserAttributes) => {
      try {
        // Extract name and avatarUrl from attributes.data if available
        const data = attributes.data as Record<string, unknown> | undefined
        const name = data?.name as string | undefined
        const avatarUrl = (data?.avatarUrl ?? data?.avatar_url) as string | undefined

        await convexAuth.updateProfile({ name, avatarUrl })
        return { error: null }
      } catch (error) {
        return { error: error as Error }
      }
    },
    [convexAuth],
  )

  return {
    user,
    session,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signInWithApple,
    signInWithMagicLink,
    verifyOtp,
    signOut,
    resetPassword,
    updateUser,
    isAuthenticated: convexAuth.isAuthenticated,
    provider: "convex",
  }
}

// ============================================================================
// Main Hook Export
// ============================================================================

/**
 * Universal authentication hook that works with both Supabase and Convex.
 *
 * Automatically detects the configured backend provider and returns
 * the appropriate implementation.
 *
 * For Supabase: Full featured auth with all methods working directly.
 *
 * For Convex: Full featured auth with proper OAuth handling for mobile.
 *   For more control, use the modular hooks directly:
 *   - useConvexSocialAuth() - Google, Apple, GitHub with mobile OAuth
 *   - useConvexPasswordAuth() - email/password authentication
 *   - useConvexMagicLink() - OTP/magic link authentication
 */
const useSelectedAuthImpl: () => UseAuthReturn = isConvex ? useConvexAuthImpl : useSupabaseAuth

export function useAuth(): UseAuthReturn {
  return useSelectedAuthImpl()
}

// ============================================================================
// Provider-Specific Hook Exports
// ============================================================================

/**
 * Force use of Supabase auth regardless of env config.
 * Useful for migration or testing scenarios.
 */
export { useSupabaseAuth }

/**
 * Force use of Convex auth regardless of env config.
 * Useful for migration or testing scenarios.
 */
export { useConvexAuthImpl as useConvexAuth }
