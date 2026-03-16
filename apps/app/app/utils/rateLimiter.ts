/**
 * Rate Limiter Utility
 *
 * Provides client-side rate limiting to prevent abuse of authentication endpoints
 * and other sensitive operations. This is a defense-in-depth measure - server-side
 * rate limiting should also be implemented.
 */

import { RATE_LIMIT } from "@/config/constants"

import { logger } from "./Logger"
import { storage } from "./storage"
import * as storageUtils from "./storage"

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
   * Get storage key for rate limit entry
   */
  private getStorageKey(identifier: string): string {
    return `${this.config.keyPrefix}:${identifier}`
  }

  /**
   * Check if an action is allowed
   * Returns true if allowed, false if rate limited
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
