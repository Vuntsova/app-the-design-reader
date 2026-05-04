/**
 * Preferences Sync Service
 *
 * Handles syncing user preferences (theme, notifications) between
 * local storage and the backend database.
 *
 * - Supabase: Uses `user_preferences` table for preferences (RLS-locked
 *   to the owning user) and `push_tokens` table for tokens. Private
 *   prefs used to live on `profiles`, but that table is world-readable
 *   for public discovery, so we moved them off — see migration
 *   20260505000000_move_private_prefs_off_profiles.sql.
 * - Convex: Preferences use Convex mutations, push tokens use convex/pushTokens.ts
 *
 * Uses fire-and-forget pattern for updates to avoid blocking UI.
 */

import { Platform } from "react-native"
import * as Device from "expo-device"
import { UnistylesRuntime } from "react-native-unistyles"

import { sentry } from "./sentry"
import { isSupabase, isConvex } from "../config/env"
import { useNotificationStore } from "../stores/notificationStore"
import type { OnboardingGoal, SupabaseDatabase, UserPreferences } from "../types/supabase"
import { logger } from "../utils/Logger"
import { storage } from "../utils/storage"

// Conditionally import Supabase - only when using Supabase backend
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { supabase, isUsingMockSupabase } = isSupabase
  ? require("./supabase")
  : { supabase: null, isUsingMockSupabase: true }

// Conditionally import Convex push token service
// eslint-disable-next-line @typescript-eslint/no-require-imports
const convexPushTokens = isConvex ? require("./backend/convex/pushTokens") : null

// For preferences (theme, notifications settings), skip sync for Convex (use React mutations instead)
const shouldSkipPreferenceSync = isConvex || isUsingMockSupabase

type _UserPreferencesUpdate = SupabaseDatabase["public"]["Tables"]["user_preferences"]["Update"]
type PushTokenInsert = SupabaseDatabase["public"]["Tables"]["push_tokens"]["Insert"]

// Storage keys (must match the keys used in theme context and notification store)
const THEME_STORAGE_KEY = "shipnative.themeScheme"

// ---------------------------------------------------------------------
// Retry queue for fire-and-forget syncs
//
// The original code dropped errors silently. We now retry up to 3 times
// with exponential backoff (1s, 3s, 9s) per key. Keys are stable per
// (preference, userId) pair, so a newer update for the same key replaces
// any pending retry — last-write-wins semantics, which is what we want
// for user-toggled preferences.
//
// This is intentionally minimal: no persistence across app restarts, no
// network-online detection. For a full offline sync system, swap this
// out for a library like @tanstack/react-query's mutation retry or a
// dedicated offline queue.
// ---------------------------------------------------------------------

const MAX_SYNC_RETRIES = 3
const SYNC_RETRY_DELAYS_MS = [1000, 3000, 9000] as const

interface PendingSync {
  fn: () => Promise<void>
  retries: number
  timer?: ReturnType<typeof setTimeout>
}

const pendingSyncs = new Map<string, PendingSync>()

function enqueueSync(key: string, fn: () => Promise<void>): void {
  // Cancel any in-flight retry for this key — newer updates win.
  const existing = pendingSyncs.get(key)
  if (existing?.timer) {
    clearTimeout(existing.timer)
  }
  pendingSyncs.set(key, { fn, retries: 0 })
  void runSync(key)
}

/**
 * Cancel all pending preference syncs and clear the retry queue.
 *
 * Called on logout so a freshly logged-in user doesn't inherit retry
 * attempts queued under the previous session's user id.
 */
export function clearPendingSyncs(): void {
  for (const entry of pendingSyncs.values()) {
    if (entry.timer) {
      clearTimeout(entry.timer)
    }
  }
  pendingSyncs.clear()
}

async function runSync(key: string): Promise<void> {
  const entry = pendingSyncs.get(key)
  if (!entry) return

  try {
    await entry.fn()
    pendingSyncs.delete(key)
  } catch (err) {
    if (entry.retries >= MAX_SYNC_RETRIES) {
      logger.error(`Sync failed after ${MAX_SYNC_RETRIES} retries`, { key }, err as Error)
      sentry.captureException(err as Error, {
        tags: { context: "preferences_sync", sync_key: key },
      })
      pendingSyncs.delete(key)
      return
    }
    const delay = SYNC_RETRY_DELAYS_MS[entry.retries] ?? 9000
    entry.retries += 1
    entry.timer = setTimeout(() => {
      void runSync(key)
    }, delay)
  }
}

/**
 * Fetch user preferences from the database
 * Returns null if using Convex, mock mode, or if fetch fails
 *
 * For Convex: Preferences are part of the user object from useQuery(api.users.me)
 */
export async function fetchUserPreferences(userId: string): Promise<UserPreferences | null> {
  if (shouldSkipPreferenceSync) {
    logger.debug("Skipping preference fetch (Convex or mock mode)")
    return null
  }

  try {
    const { data, error } = await supabase
      .from("user_preferences")
      .select(
        "dark_mode_enabled, notifications_enabled, push_notifications_enabled, email_notifications_enabled",
      )
      .eq("id", userId)
      .single()

    if (error) {
      // Table might not exist or user has no row yet - that's okay
      logger.debug("Failed to fetch user preferences", { error: error.message })
      return null
    }

    return data as UserPreferences
  } catch (error) {
    logger.debug("Error fetching user preferences", { error })
    return null
  }
}

/**
 * Update a single preference in the database (fire-and-forget)
 * Does not block - updates happen in background
 *
 * For Convex: Use useMutation(api.users.updatePreferences) instead
 */
export function updatePreference(
  userId: string,
  preference: keyof UserPreferences,
  value: boolean,
): void {
  if (shouldSkipPreferenceSync) {
    logger.debug(`Skipping ${preference} sync (Convex or mock mode)`)
    return
  }

  const update = {
    id: userId,
    [preference]: value,
    updated_at: new Date().toISOString(),
  } as const

  // Fire and forget with retry queue. Key is per-(preference, user) so a
  // newer toggle for the same preference cancels any in-flight retry.
  enqueueSync(`${preference}:${userId}`, async () => {
    const { error } = await supabase.from("user_preferences").upsert(update)
    if (error) {
      logger.debug(`Failed to sync ${preference} preference`, { error: error.message })
      throw new Error(error.message)
    }
    logger.debug(`Synced ${preference} preference to database`, { value })
  })
}

/**
 * Update dark mode preference
 */
export function syncDarkModePreference(userId: string, enabled: boolean): void {
  updatePreference(userId, "dark_mode_enabled", enabled)
}

/**
 * Update push notifications preference
 */
export function syncPushNotificationsPreference(userId: string, enabled: boolean): void {
  updatePreference(userId, "push_notifications_enabled", enabled)
}

/**
 * Update general notifications preference
 */
export function syncNotificationsPreference(userId: string, enabled: boolean): void {
  updatePreference(userId, "notifications_enabled", enabled)
}

/**
 * Update email notifications preference
 */
export function syncEmailNotificationsPreference(userId: string, enabled: boolean): void {
  updatePreference(userId, "email_notifications_enabled", enabled)
}

/**
 * Update onboarding goal preference (fire-and-forget).
 *
 * Goal is a string union, not a boolean, so it bypasses `updatePreference`
 * (which is typed for booleans only). Storage is the same `user_preferences`
 * row — another agent owns the schema migration; this just writes to the
 * in-memory shape the rest of the app reads.
 */
export function syncGoalPreference(userId: string, goal: OnboardingGoal): void {
  if (shouldSkipPreferenceSync) {
    logger.debug("Skipping goal sync (Convex or mock mode)")
    return
  }

  const update = {
    id: userId,
    goal,
    updated_at: new Date().toISOString(),
  } as const

  enqueueSync(`goal:${userId}`, async () => {
    const { error } = await supabase.from("user_preferences").upsert(update)
    if (error) {
      logger.debug("Failed to sync goal preference", { error: error.message })
      throw new Error(error.message)
    }
    logger.debug("Synced goal preference to database", { goal })
  })
}

/**
 * Sync all preferences at once (fire-and-forget)
 *
 * For Convex: Use useMutation(api.users.updatePreferences) instead
 */
export function syncAllPreferences(userId: string, preferences: Partial<UserPreferences>): void {
  if (shouldSkipPreferenceSync) {
    logger.debug("Skipping all preferences sync (Convex or mock mode)")
    return
  }

  const update = {
    id: userId,
    ...preferences,
    updated_at: new Date().toISOString(),
  }

  enqueueSync(`all_preferences:${userId}`, async () => {
    const { error } = await supabase.from("user_preferences").upsert({ ...update, id: userId })
    if (error) {
      logger.debug("Failed to sync preferences", { error: error.message })
      throw new Error(error.message)
    }
    logger.debug("Synced all preferences to database")
  })
}

/**
 * Apply fetched preferences to local storage and stores
 * Call this after successful login to sync server preferences to local state
 */
export function applyUserPreferences(preferences: UserPreferences): void {
  // Apply dark mode preference
  if (preferences.dark_mode_enabled !== null) {
    const themeValue = preferences.dark_mode_enabled ? "dark" : "light"
    storage.set(THEME_STORAGE_KEY, themeValue)
    // Update Unistyles runtime
    UnistylesRuntime.setAdaptiveThemes(false)
    UnistylesRuntime.setTheme(themeValue)
    logger.debug("Applied dark mode preference from database", {
      value: preferences.dark_mode_enabled,
    })
  }

  // Apply push notifications preference
  if (preferences.push_notifications_enabled !== null) {
    // Get the notification store state and update it
    const notificationState = useNotificationStore.getState()
    if (notificationState.isPushEnabled !== preferences.push_notifications_enabled) {
      useNotificationStore.setState({ isPushEnabled: preferences.push_notifications_enabled })
      logger.debug("Applied push notification preference from database", {
        value: preferences.push_notifications_enabled,
      })
    }
  }
}

/**
 * Fetch and apply user preferences on login
 * Returns true if preferences were successfully fetched and applied
 */
export async function fetchAndApplyUserPreferences(userId: string): Promise<boolean> {
  const preferences = await fetchUserPreferences(userId)

  if (preferences) {
    applyUserPreferences(preferences)
    return true
  }

  return false
}

// =====================================================================
// PUSH TOKEN SYNC
// =====================================================================

/**
 * Get a unique device identifier
 * Uses a combination of device info to create a stable ID
 */
function getDeviceId(): string {
  // Create a pseudo-unique device ID from available device info
  const parts = [Platform.OS, Device.modelName ?? "unknown", Device.osVersion ?? "unknown"]
  return parts.join("-").toLowerCase().replace(/\s+/g, "-")
}

/**
 * Get a human-readable device name
 */
function getDeviceName(): string {
  if (Platform.OS === "web") {
    return "Web Browser"
  }
  return Device.modelName ?? `${Platform.OS} Device`
}

/**
 * Get the platform type for the database
 */
function getPlatform(): "ios" | "android" | "web" {
  if (Platform.OS === "ios") return "ios"
  if (Platform.OS === "android") return "android"
  return "web"
}

/**
 * Sync push token to the database
 * Uses upsert to handle both new tokens and updates
 *
 * Works with both Supabase and Convex backends.
 *
 * @param userId - The authenticated user's ID (ignored for Convex, uses auth context)
 * @param token - The Expo push token (e.g., ExponentPushToken[xxx])
 */
export function syncPushToken(userId: string, token: string): void {
  if (!token) {
    logger.debug("No push token to sync")
    return
  }

  // Use Convex push token service if available
  if (isConvex && convexPushTokens) {
    void convexPushTokens.syncPushToken(token)
    return
  }

  // Skip if mock mode (no Supabase)
  if (isUsingMockSupabase) {
    logger.debug("Skipping push token sync (mock mode)")
    return
  }

  const tokenData: PushTokenInsert = {
    user_id: userId,
    token,
    device_id: getDeviceId(),
    device_name: getDeviceName(),
    platform: getPlatform(),
    is_active: true,
    last_used_at: new Date().toISOString(),
  }

  // Fire and forget with retry. Key is per-(user, token) so re-syncing the
  // same token replaces any pending retry instead of stacking duplicates.
  enqueueSync(`push_token:${userId}:${token}`, async () => {
    const { error } = await supabase
      .from("push_tokens")
      .upsert(tokenData, { onConflict: "user_id,token" })
    if (error) {
      logger.debug("Failed to sync push token", { error: error.message })
      throw new Error(error.message)
    }
    logger.debug("Push token synced to database", {
      platform: tokenData.platform,
      deviceName: tokenData.device_name,
    })
  })
}

/**
 * Deactivate push token when user logs out or disables notifications
 * Instead of deleting, we mark as inactive to maintain history
 *
 * Works with both Supabase and Convex backends.
 *
 * @param userId - The authenticated user's ID (ignored for Convex, uses auth context)
 * @param token - The Expo push token to deactivate
 */
export function deactivatePushToken(userId: string, token: string): void {
  if (!token) {
    return
  }

  // Use Convex push token service if available
  if (isConvex && convexPushTokens) {
    void convexPushTokens.deactivatePushToken(token)
    return
  }

  // Skip if mock mode (no Supabase)
  if (isUsingMockSupabase) {
    return
  }

  enqueueSync(`deactivate_token:${userId}:${token}`, async () => {
    const { error } = await supabase
      .from("push_tokens")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("token", token)
    if (error) {
      logger.debug("Failed to deactivate push token", { error: error.message })
      throw new Error(error.message)
    }
    logger.debug("Push token deactivated")
  })
}

/**
 * Deactivate all push tokens for a user (e.g., on logout)
 *
 * Works with both Supabase and Convex backends.
 *
 * @param userId - The authenticated user's ID (ignored for Convex, uses auth context)
 */
export function deactivateAllPushTokens(userId: string): void {
  // Use Convex push token service if available
  if (isConvex && convexPushTokens) {
    void convexPushTokens.deactivateAllPushTokens()
    return
  }

  // Skip if mock mode (no Supabase)
  if (isUsingMockSupabase) {
    return
  }

  enqueueSync(`deactivate_all_tokens:${userId}`, async () => {
    const { error } = await supabase
      .from("push_tokens")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
    if (error) {
      logger.debug("Failed to deactivate all push tokens", { error: error.message })
      throw new Error(error.message)
    }
    logger.debug("All push tokens deactivated for user")
  })
}
