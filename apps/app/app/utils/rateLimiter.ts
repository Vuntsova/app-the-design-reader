/**
 * Rate Limiter Utility
 *
 * Provides client-side rate limiting to prevent abuse of authentication endpoints
 * and other sensitive operations. This is a defense-in-depth measure - server-side
 * rate limiting should also be implemented.
 */

import { Platform } from "react-native"
import * as Application from "expo-application"

import { RATE_LIMIT } from "@/config/constants"

import { logger } from "./Logger"
import { storage } from "./storage"
import * as storageUtils from "./storage"

const INSTALL_ID_KEY = "app:installId"

/**
 * Generate a non-cryptographic random hex token for use as an install ID
 * fallback. Security doesn't matter here — this value only salts local
 * rate-limit keys so an attacker on this device can't lock out a victim's
 * email by sweeping it. The real defense lives on the server.
 */
function generateFallbackInstallId(): string {
  let out = ""
  for (let i = 0; i < 4; i++) {
    out += Math.random().toString(36).slice(2, 12)
  }
  return out
}

/**
 * Resolve a stable per-install ID, cached in MMKV under `app:installId`.
 *
 * Preference order:
 *   1. Cached value in MMKV (set on a previous launch).
 *   2. expo-application's platform install ID (Android: getAndroidId,
 *      iOS: getIosIdForVendorAsync — fetched in the background and
 *      promoted on the next launch).
 *   3. A locally-generated random token.
 *
 * Resolved synchronously so the rate limiter (which exposes both async
 * and sync-friendly call sites) can compute keys without awaiting.
 */
function resolveInstallId(): string {
  try {
    const cached = storageUtils.loadString(INSTALL_ID_KEY)
    if (cached && cached.length > 0) return cached
  } catch {
    // fall through to derive a new one
  }

  let installId: string | null = null

  try {
    if (Platform.OS === "android") {
      const androidId = Application.getAndroidId()
      if (androidId && androidId.length > 0) installId = androidId
    }
  } catch {
    // ignore — we'll fall back to the random token below
  }

  // On iOS getIosIdForVendorAsync is async; kick it off so a future launch
  // can upgrade the cached value, but don't block the current call.
  if (!installId && Platform.OS === "ios") {
    Application.getIosIdForVendorAsync()
      .then((id) => {
        if (id && id.length > 0) {
          try {
            storageUtils.saveString(INSTALL_ID_KEY, id)
          } catch {
            // best-effort
          }
        }
      })
      .catch(() => {
        // best-effort; the random fallback is already in use
      })
  }

  if (!installId) installId = generateFallbackInstallId()

  try {
    storageUtils.saveString(INSTALL_ID_KEY, installId)
  } catch {
    // best-effort
  }

  return installId
}

// Resolved once at module init so all RateLimiter instances share a key
// salt without doing async work on the hot path.
const INSTALL_ID = resolveInstallId()

declare global {
  // eslint-disable-next-line no-var
  var clearRateLimits: (() => Promise<void>) | undefined
}

interface RateLimitEntry {
  count: number
  resetAt: number // Timestamp when limit resets
}

interface RateLimitConfig {
  maxAttempts: number
  windowMs: number // Time window in milliseconds
  keyPrefix: string
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxAttempts: RATE_LIMIT.MAX_ATTEMPTS_AUTH,
  windowMs: RATE_LIMIT.WINDOW_AUTH_MS,
  keyPrefix: "rate_limit",
}

/**
 * Rate limiter class
 */
class RateLimiter {
  private config: RateLimitConfig

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Get storage key for rate limit entry.
   *
   * Keys are salted with a per-install ID so an attacker sweeping a
   * victim's email on their own device can't push a counter that locks
   * the victim out when they try to sign in on their own phone. This is
   * a UX guard only — server-side rate limits are the real defense.
   */
  private getStorageKey(identifier: string): string {
    return `${this.config.keyPrefix}:${INSTALL_ID}:${identifier}`
  }

  /**
   * Check if an action is allowed.
   * Returns true if allowed, false if rate limited.
   *
   * Keyed by install ID + identifier so an attacker can't lock another
   * user's email from their own device. This is a UX guard only —
   * server-side limits are the real defense.
   */
  async isAllowed(identifier: string): Promise<boolean> {
    try {
      const key = this.getStorageKey(identifier)
      const stored = storageUtils.load(key) as RateLimitEntry | undefined

      const now = Date.now()

      // If no entry exists or window has expired, allow and create new entry
      if (!stored || now >= stored.resetAt) {
        const newEntry: RateLimitEntry = {
          count: 1,
          resetAt: now + this.config.windowMs,
        }
        storageUtils.save(key, newEntry)
        return true
      }

      // Check if limit exceeded
      if (stored.count >= this.config.maxAttempts) {
        return false
      }

      // Increment count
      stored.count++
      storageUtils.save(key, stored)
      return true
    } catch (error) {
      // Client-side rate limiter fails open on internal errors.
      // Server-side rate limiting is the primary protection.
      // Failing closed here would lock users out if MMKV storage is corrupted.
      logger.error(
        "[RateLimiter] Error checking rate limit, allowing request (fail-open)",
        {},
        error as Error,
      )
      return true
    }
  }

  /**
   * Get remaining attempts for an identifier
   */
  async getRemainingAttempts(identifier: string): Promise<number> {
    try {
      const key = this.getStorageKey(identifier)
      const stored = storageUtils.load(key) as RateLimitEntry | undefined

      if (!stored) {
        return this.config.maxAttempts
      }

      const now = Date.now()
      if (now >= stored.resetAt) {
        return this.config.maxAttempts
      }

      return Math.max(0, this.config.maxAttempts - stored.count)
    } catch {
      return this.config.maxAttempts
    }
  }

  /**
   * Get time until rate limit resets (in milliseconds)
   */
  async getResetTime(identifier: string): Promise<number> {
    try {
      const key = this.getStorageKey(identifier)
      const stored = storageUtils.load(key) as RateLimitEntry | undefined

      if (!stored) {
        return 0
      }

      const now = Date.now()
      return Math.max(0, stored.resetAt - now)
    } catch {
      return 0
    }
  }

  /**
   * Reset rate limit for an identifier
   */
  async reset(identifier: string): Promise<void> {
    try {
      const key = this.getStorageKey(identifier)
      storageUtils.remove(key)
    } catch (error) {
      if (__DEV__) {
        logger.error("[RateLimiter] Error resetting rate limit", {}, error as Error)
      }
    }
  }

  /**
   * Clear all rate limit entries (useful for testing)
   */
  async clearAll(): Promise<void> {
    try {
      const keys = storage.getAllKeys()
      const prefix = `${this.config.keyPrefix}:`
      keys.forEach((key) => {
        if (key.startsWith(prefix)) {
          storageUtils.remove(key)
        }
      })
    } catch (error) {
      if (__DEV__) {
        logger.error("[RateLimiter] Error clearing rate limits", {}, error as Error)
      }
    }
  }
}

// Pre-configured rate limiters for common use cases
export const authRateLimiter = new RateLimiter({
  maxAttempts: RATE_LIMIT.MAX_ATTEMPTS_AUTH,
  windowMs: RATE_LIMIT.WINDOW_AUTH_MS,
  keyPrefix: "rate_limit_auth",
})

/**
 * Clear all rate limits (useful for development/testing)
 * Exposed globally in dev mode for easy access via console
 */
if (__DEV__) {
  global.clearRateLimits = async () => {
    await authRateLimiter.clearAll()
    await passwordResetRateLimiter.clearAll()
    await signUpRateLimiter.clearAll()
    logger.info("✅ All rate limits cleared")
  }
  logger.info("💡 Dev tip: Use global.clearRateLimits() in console to clear all rate limits")
}

export const passwordResetRateLimiter = new RateLimiter({
  maxAttempts: RATE_LIMIT.MAX_ATTEMPTS_PASSWORD_RESET,
  windowMs: RATE_LIMIT.WINDOW_PASSWORD_RESET_MS,
  keyPrefix: "rate_limit_password_reset",
})

export const signUpRateLimiter = new RateLimiter({
  maxAttempts: RATE_LIMIT.MAX_ATTEMPTS_SIGNUP,
  windowMs: RATE_LIMIT.WINDOW_SIGNUP_MS,
  keyPrefix: "rate_limit_signup",
})

// Export class for custom configurations
export { RateLimiter }
