import { Linking } from "react-native"
import type * as Notifications from "expo-notifications"

import { getAppScheme } from "./appScheme"
import { logger } from "./Logger"

// Note: Navigation will be handled by React Navigation in the app
// This file provides utility functions for parsing deep links
// Actual navigation should be done via navigationRef in your navigators

/**
 * Deep link URL scheme
 * Format: <scheme>://screen/path?param=value
 */
export const DEEP_LINK_SCHEME = getAppScheme()

/**
 * Parse deep link URL into components
 */
export function parseDeepLink(url: string): {
  screen?: string
  path?: string
  params?: Record<string, string>
} | null {
  try {
    const parsedUrl = new URL(url)

    // Check if it's our scheme
    if (parsedUrl.protocol !== `${DEEP_LINK_SCHEME}:`) {
      return null
    }

    // Extract screen/path
    const pathParts = parsedUrl.pathname.split("/").filter(Boolean)
    const screen = pathParts[0] || parsedUrl.hostname || undefined
    const path = pathParts.slice(1).join("/")

    // Extract query params
    const params: Record<string, string> = {}
    parsedUrl.searchParams.forEach((value, key) => {
      params[key] = value
    })

    return {
      screen,
      path: path || undefined,
      params: Object.keys(params).length > 0 ? params : undefined,
    }
  } catch (error) {
    logger.error("[DeepLinking] Error parsing deep link", {}, error as Error)
    return null
  }
}

/**
 * Validate UUID format (for email verification tokens)
 */
function isValidUUID(token: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(token)
}

/**
 * Validate JWT format (for password reset tokens)
 * JWT format: header.payload.signature (base64url encoded, separated by dots)
 */
function isValidJWT(token: string): boolean {
  // JWT should have 3 parts separated by dots
  const parts = token.split(".")
  if (parts.length !== 3) {
    return false
  }

  // Each part should be base64url encoded (alphanumeric, -, _)
  const base64UrlRegex = /^[A-Za-z0-9_-]+$/
  if (!parts.every((part) => part.length > 0 && base64UrlRegex.test(part))) {
    return false
  }

  // Reasonable length check (JWT tokens are typically 100-500 chars)
  if (token.length < 50 || token.length > 2000) {
    return false
  }

  return true
}

/**
 * Validate token for sensitive deep links (reset-password, verify-email)
 * SECURITY: Validates token format to prevent basic injection attacks
 *
 * Note: This performs format validation only. Full cryptographic validation
 * happens server-side when the token is actually used.
 */
async function validateDeepLinkToken(screen: string, token?: string): Promise<boolean> {
  if (!token || typeof token !== "string") {
    return false
  }

  // Only validate tokens for sensitive screens
  if (screen !== "reset-password" && screen !== "verify-email") {
    return true
  }

  try {
    // Trim whitespace
    const trimmedToken = token.trim()
    if (trimmedToken.length === 0) {
      return false
    }

    if (screen === "reset-password") {
      // Password reset tokens from Supabase are typically JWTs
      // Validate JWT format: header.payload.signature
      return isValidJWT(trimmedToken)
    }

    if (screen === "verify-email") {
      // Email verification tokens can be UUIDs or JWTs
      // Accept either format
      return isValidUUID(trimmedToken) || isValidJWT(trimmedToken)
    }

    return false
  } catch (error) {
    logger.error("[DeepLinking] Token validation failed", { screen }, error as Error)
    return false
  }
}

/**
 * Handle deep link navigation
 * Returns parsed link data for the app to handle navigation
 * SECURITY: Validates tokens for sensitive operations
 */
export async function handleDeepLink(url: string): Promise<{
  screen: string
  params?: Record<string, string>
} | null> {
  const parsed = parseDeepLink(url)

  if (!parsed || !parsed.screen) {
    if (__DEV__) {
      logger.warn("[DeepLinking] Invalid deep link", { url })
    }
    return null
  }

  // SECURITY: Validate tokens for sensitive deep links
  if (parsed.params?.token) {
    const isValid = await validateDeepLinkToken(parsed.screen, parsed.params.token)
    if (!isValid) {
      logger.warn("[DeepLinking] Invalid token in deep link", {
        screen: parsed.screen,
        // Don't log the actual token
      })
      return null
    }
  }

  if (__DEV__) {
    logger.debug("[DeepLinking] Parsed deep link", {
      screen: parsed.screen,
      hasParams: !!parsed.params,
      // Don't log params as they may contain tokens
    })
  }

  // Return parsed data for app to handle navigation with React Navigation
  return {
    screen: parsed.screen,
    params: parsed.params,
  }
}

/**
 * Generate deep link URL
 */
export function generateDeepLink(screen: string, params?: Record<string, string>): string {
  let url = `${DEEP_LINK_SCHEME}://${screen}`

  if (params && Object.keys(params).length > 0) {
    const queryString = new URLSearchParams(params).toString()
    url += `?${queryString}`
  }

  return url
}

/**
 * Common deep link routes
 */
export const DeepLinkRoutes = {
  // Auth
  RESET_PASSWORD: (token: string) => generateDeepLink("reset-password", { token }),
  VERIFY_EMAIL: (token: string) => generateDeepLink("verify-email", { token }),

  // App screens
  PROFILE: () => generateDeepLink("profile"),
  PAYWALL: () => generateDeepLink("paywall"),
  SETTINGS: () => generateDeepLink("settings"),

  // Referral
  REFERRAL: (code: string) => generateDeepLink("referral", { code }),

  // Share
  SHARE_CONTENT: (id: string) => generateDeepLink("share", { id }),
}

/**
 * Handle deep link from notification
 * Returns parsed link for app to handle navigation
 */
export async function handleNotificationDeepLink(
  response: Notifications.NotificationResponse,
): Promise<{
  screen: string
  params?: Record<string, string>
} | null> {
  const data = response.notification.request.content.data

  if (data?.deepLink) {
    // If notification has full deep link URL
    return await handleDeepLink(data.deepLink as string)
  } else if (data?.screen) {
    // If notification has screen and params
    return {
      screen: data.screen as string,
      params: data.params as Record<string, string>,
    }
  }

  return null
}

/**
 * Initialize deep linking
 * Pass a callback to handle navigation with React Navigation
 */
export async function initializeDeepLinking(
  onDeepLink?: (linkData: { screen: string; params?: Record<string, string> }) => void,
) {
  // Handle app opened from deep link (app was closed)
  const initialUrl = await Linking.getInitialURL()
  if (initialUrl) {
    if (__DEV__) {
      logger.debug("[DeepLinking] App opened with URL", {
        // Don't log full URL as it may contain tokens
        hasUrl: !!initialUrl,
      })
    }
    const parsed = await handleDeepLink(initialUrl)
    if (parsed && onDeepLink) {
      onDeepLink(parsed)
    }
  }

  // Handle deep links while app is running
  const subscription = Linking.addEventListener("url", async ({ url }) => {
    if (__DEV__) {
      logger.debug("[DeepLinking] Received URL while running", {
        // Don't log full URL as it may contain tokens
        hasUrl: !!url,
      })
    }
    const parsed = await handleDeepLink(url)
    if (parsed && onDeepLink) {
      onDeepLink(parsed)
    }
  })

  return subscription
}

/**
 * Deep linking utilities export
 */
export const deepLinking = {
  parse: parseDeepLink,
  handle: handleDeepLink,
  generate: generateDeepLink,
  initialize: initializeDeepLinking,
  handleNotification: handleNotificationDeepLink,
  routes: DeepLinkRoutes,
  scheme: DEEP_LINK_SCHEME,
}
