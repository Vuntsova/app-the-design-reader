/**
 * Convex Social Auth Hook
 *
 * Provides social sign-in functionality for Convex Auth.
 * Handles OAuth flows for Google, Apple, and GitHub with
 * proper React Native / Web support.
 */

import { useCallback, useState } from "react"
import { Platform } from "react-native"
import { makeRedirectUri } from "expo-auth-session"
import * as Linking from "expo-linking"
import { useAuthActions } from "@convex-dev/auth/react"

import { logger } from "../../utils/Logger"
import { clearOAuthState, createOAuthState } from "../../utils/oauthState"

// ============================================================================
// Platform-specific imports
// ============================================================================

const getWebBrowser = () => {
  if (Platform.OS === "web") return null
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-web-browser")
  } catch {
    logger.warn("[ConvexSocialAuth] expo-web-browser not available")
    return null
  }
}

const WebBrowser = getWebBrowser()

// Initialize web browser auth session handling
if (WebBrowser?.maybeCompleteAuthSession) {
  WebBrowser.maybeCompleteAuthSession()
}

// ============================================================================
// Types
// ============================================================================

export type SocialProvider = "google" | "apple" | "github"

export interface SocialAuthResult {
  error: Error | null
}

export interface UseConvexSocialAuthReturn {
  /** Sign in with Google (native on mobile, OAuth on web) */
  signInWithGoogle: () => Promise<SocialAuthResult>
  /** Sign in with Apple (OAuth flow) */
  signInWithApple: () => Promise<SocialAuthResult>
  /** Sign in with GitHub (OAuth flow) */
  signInWithGitHub: () => Promise<SocialAuthResult>
  /** Generic OAuth sign in */
  signInWithOAuth: (provider: SocialProvider) => Promise<SocialAuthResult>
  /** Whether an OAuth flow is in progress */
  loading: boolean
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for social authentication with Convex
 *
 * @example
 * ```tsx
 * function SocialButtons() {
 *   const { signInWithGoogle, signInWithApple, loading } = useConvexSocialAuth()
 *
 *   return (
 *     <>
 *       <Button onPress={signInWithGoogle} disabled={loading}>
 *         Sign in with Google
 *       </Button>
 *       <Button onPress={signInWithApple} disabled={loading}>
 *         Sign in with Apple
 *       </Button>
 *     </>
 *   )
 * }
 * ```
 */
export function useConvexSocialAuth(): UseConvexSocialAuthReturn {
  const { signIn } = useAuthActions()
  const [loading, setLoading] = useState(false)

  /**
   * Get the redirect URI for OAuth flows
   * Note: For native platforms, makeRedirectUri() will use the scheme from app.json
   */
  const getRedirectUri = useCallback((): string | undefined => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") {
        return `${window.location.origin}/auth/callback`
      }
      return undefined
    }

    // Use makeRedirectUri without arguments to let it auto-detect the correct format
    // For development builds, this will be: shipnative://
    // For Expo Go, this will be: exp://127.0.0.1:8081/--/
    const uri = makeRedirectUri()

    if (__DEV__) {
      logger.debug("[ConvexSocialAuth] Generated redirect URI:", { uri })
    }

    return uri
  }, [])

  /**
   * Handle OAuth flow for mobile platforms
   * Opens an in-app browser and handles the callback
   */
  const handleMobileOAuthFlow = useCallback(
    async (provider: SocialProvider, redirectUrl: string): Promise<SocialAuthResult> => {
      const redirectTo = getRedirectUri()

      if (__DEV__) {
        logger.debug(`[ConvexSocialAuth] Starting ${provider} OAuth flow`, {
          redirectTo,
          redirectUrl: redirectUrl.substring(0, 50) + "...",
        })
      }

      if (!WebBrowser) {
        // Fallback to system browser
        const canOpen = await Linking.canOpenURL(redirectUrl)
        if (canOpen) {
          await Linking.openURL(redirectUrl)
          return { error: null }
        }
        return { error: new Error("Unable to open OAuth URL") }
      }

      try {
        logger.info(`[ConvexSocialAuth] Opening auth session`, {
          redirectUrl: redirectUrl.substring(0, 100),
          redirectTo,
        })

        const result = await WebBrowser.openAuthSessionAsync(redirectUrl, redirectTo)

        logger.info(`[ConvexSocialAuth] OAuth session result`, {
          type: result.type,
          hasUrl: !!result.url,
          url: result.url?.substring(0, 100),
        })

        if (result.type === "success" && result.url) {
          // Extract the code from the callback URL
          const url = new URL(result.url)
          const code = url.searchParams.get("code")

          if (code) {
            // Complete the OAuth flow by sending the code to Convex
            await signIn(provider, { code })
            return { error: null }
          }

          // Check for errors in the URL
          const errorParam = url.searchParams.get("error")
          if (errorParam) {
            const errorDesc = url.searchParams.get("error_description") || errorParam
            return { error: new Error(errorDesc) }
          }
        }

        if (result.type === "cancel" || result.type === "dismiss") {
          clearOAuthState()
          return { error: new Error("OAuth flow cancelled") }
        }

        return { error: null }
      } catch (error) {
        clearOAuthState()
        logger.error(`[ConvexSocialAuth] OAuth flow failed`, {}, error as Error)
        return { error: error as Error }
      }
    },
    [signIn, getRedirectUri],
  )

  /**
   * Generic OAuth sign-in handler
   */
  const signInWithOAuth = useCallback(
    async (provider: SocialProvider): Promise<SocialAuthResult> => {
      setLoading(true)

      // Create and persist a CSRF state token before opening the OAuth flow.
      // AuthCallbackScreen calls consumeOAuthState() with the state echoed back
      // in the callback URL — if storage is empty or the values don't match,
      // the callback is rejected. Mirrors the Supabase social-auth path.
      const oauthState = createOAuthState()

      try {
        const redirectTo = getRedirectUri()

        // Start the OAuth flow. Pass our CSRF state alongside redirectTo so
        // Convex Auth forwards it through the OAuth roundtrip and we can
        // validate it on callback.
        const params: Record<string, string> = { state: oauthState }
        if (redirectTo) {
          params.redirectTo = redirectTo
        }
        const result = await signIn(provider, params)

        // On web, the redirect happens automatically
        if (Platform.OS === "web") {
          // The page will redirect to the OAuth provider
          return { error: null }
        }

        // On mobile, we need to handle the OAuth flow manually
        if (result?.redirect) {
          // Convert URL to string if needed
          const redirectUrl =
            typeof result.redirect === "string" ? result.redirect : result.redirect.toString()
          return await handleMobileOAuthFlow(provider, redirectUrl)
        }

        // If signingIn is true, the flow completed immediately (e.g., already authenticated)
        if (result?.signingIn) {
          return { error: null }
        }

        return { error: null }
      } catch (error) {
        clearOAuthState()
        const errorMessage = error instanceof Error ? error.message : String(error)

        // Don't treat cancellation as an error to show to user
        if (
          errorMessage.includes("cancel") ||
          errorMessage.includes("dismiss") ||
          errorMessage.includes("user denied")
        ) {
          return { error: new Error("OAuth flow cancelled") }
        }

        logger.error(`[ConvexSocialAuth] ${provider} sign-in failed`, {}, error as Error)
        return { error: error as Error }
      } finally {
        setLoading(false)
      }
    },
    [signIn, getRedirectUri, handleMobileOAuthFlow],
  )

  /**
   * Sign in with Google
   * Uses OAuth flow for Convex Auth (native Google Sign-In is not supported by Convex Auth)
   */
  const signInWithGoogle = useCallback(async (): Promise<SocialAuthResult> => {
    // Convex Auth requires OAuth flow - it doesn't support native Google ID token verification
    // So we go directly to OAuth instead of trying native first
    return signInWithOAuth("google")
  }, [signInWithOAuth])

  /**
   * Sign in with Apple
   */
  const signInWithApple = useCallback(async (): Promise<SocialAuthResult> => {
    return signInWithOAuth("apple")
  }, [signInWithOAuth])

  /**
   * Sign in with GitHub
   */
  const signInWithGitHub = useCallback(async (): Promise<SocialAuthResult> => {
    return signInWithOAuth("github")
  }, [signInWithOAuth])

  return {
    signInWithGoogle,
    signInWithApple,
    signInWithGitHub,
    signInWithOAuth,
    loading,
  }
}
