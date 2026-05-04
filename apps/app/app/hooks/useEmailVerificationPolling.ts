/**
 * Email Verification Polling Hook
 *
 * Custom hook that polls for email confirmation status.
 * Extracted from EmailVerificationScreen to simplify the component.
 *
 * This hook automatically polls the backend to check if the user's email has been confirmed.
 * It pauses polling briefly after resending the confirmation email to avoid conflicts.
 *
 * Uses the backend abstraction layer for provider-agnostic auth functionality.
 */

import { useEffect, useRef, useState } from "react"

import { POLLING } from "../config/constants"
import { getBackend } from "../services/backend"
import { useAuthStore } from "../stores/auth"
import type { User } from "../types/auth"
import { logger } from "../utils/Logger"

interface UseEmailVerificationPollingOptions {
  /** Whether the email is already confirmed */
  isEmailConfirmed: boolean
  /** Current user object */
  user: User | null
  /** Function to reinitialize auth state */
  initialize: () => Promise<void>
  /** Ref to track when resend was last called (to pause polling) */
  resendTimestampRef: React.MutableRefObject<number>
}

/**
 * Hook to poll for email verification status.
 *
 * Polls the backend every few seconds to check if email has been confirmed.
 * Automatically stops polling when email is confirmed or user is not available.
 *
 * @param options - Configuration options for polling
 * @returns Object with `checkingStatus` boolean indicating if a check is in progress
 *
 * @example
 * ```typescript
 * const { checkingStatus } = useEmailVerificationPolling({
 *   isEmailConfirmed,
 *   user,
 *   initialize,
 *   resendTimestampRef,
 * })
 * ```
 */
export function useEmailVerificationPolling({
  isEmailConfirmed,
  user,
  initialize,
  resendTimestampRef,
}: UseEmailVerificationPollingOptions) {
  const [checkingStatus, setCheckingStatus] = useState(false)

  // Capture initialize in a ref so it doesn't retrigger the polling effect.
  // Zustand actions are stable in practice, but stashing in a ref guarantees it.
  const initializeRef = useRef(initialize)
  useEffect(() => {
    initializeRef.current = initialize
  }, [initialize])

  // Polling restarts only when the user identity (id) changes.
  useEffect(() => {
    if (isEmailConfirmed) {
      // Email confirmed - reinitialize to update auth state
      initializeRef.current()
      return
    }

    // Don't start polling if we don't have a user
    if (!user?.id) {
      return
    }

    const interval = setInterval(async () => {
      // Pause polling briefly after resend to avoid conflicts
      const timeSinceResend = Date.now() - resendTimestampRef.current
      if (timeSinceResend < POLLING.EMAIL_VERIFICATION_PAUSE_AFTER_RESEND) {
        return
      }

      setCheckingStatus(true)
      try {
        // Store current user before polling to preserve it on error.
        // Read from the store at poll time so we always have the freshest user.
        const currentUser = useAuthStore.getState().user

        // Refresh user data to get latest email confirmation status
        // This is important when email is confirmed from another device/browser
        try {
          const backend = getBackend()
          const { data, error: getUserError } = await backend.auth.getUser()

          if (data?.user) {
            // Update user in store if email was confirmed
            // Convert from BackendUser to User type expected by the store
            useAuthStore.getState().setUser(data.user as unknown as User)
          } else if (getUserError && currentUser) {
            // If getUser fails but we have a current user, preserve it
            // Don't update the store - keep existing user state
            return
          }
        } catch (error) {
          // If getUser throws, preserve existing user and skip this poll cycle
          logger.warn("Email verification polling: getUser failed", {
            error: error instanceof Error ? error.message : String(error),
          })
          if (currentUser) {
            return
          }
        }

        // Only call initialize if we still have a user
        const userBeforeInitialize = useAuthStore.getState().user
        if (userBeforeInitialize) {
          await initializeRef.current()

          // After initialize, verify user still exists - if not, restore it
          const userAfterInitialize = useAuthStore.getState().user
          if (!userAfterInitialize && userBeforeInitialize) {
            // User was cleared during initialize - restore it
            useAuthStore.getState().setUser(userBeforeInitialize)
          }
        }
      } catch (error) {
        // On any error, preserve the existing user
        logger.warn("Email verification polling: poll cycle failed", {
          error: error instanceof Error ? error.message : String(error),
        })
        const existingUser = useAuthStore.getState().user
        if (!existingUser && user) {
          // User was lost - restore it from the snapshot we had when polling started
          useAuthStore.getState().setUser(user)
        }
      } finally {
        setCheckingStatus(false)
      }
    }, POLLING.EMAIL_VERIFICATION_INTERVAL)

    return () => clearInterval(interval)
  }, [isEmailConfirmed, user?.id])

  return { checkingStatus }
}
