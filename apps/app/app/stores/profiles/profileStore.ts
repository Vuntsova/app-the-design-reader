/**
 * Saved birth-data profiles.
 *
 * Invariants (enforced by the store, not the type system):
 *   - At most one profile has isPrimary=true. That profile represents the
 *     app user. It cannot be deleted or duplicated. Compatibility is
 *     always measured against it.
 *   - `Relationship` covers only partner / friend / child. The primary has
 *     no relationship field.
 *
 * Persistence: MMKV via Shipnative's utils/storage. Same Zustand + persist
 * pattern as subscriptionStore.ts. When Supabase auth lands the persisted
 * set moves to a Postgres table and this store becomes a cache in front.
 *
 * Charts are cached alongside each profile. See CHART_CACHE_VERSION for the
 * invalidation strategy.
 */

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import type { ChartResponse } from "@/services/chart"
import * as storage from "@/utils/storage"

import type { Profile, ProfileState } from "./profileTypes"

/**
 * Bump this whenever the engine's payload contract changes (new fields,
 * removed fields, corrected values). Cached charts with a mismatched version
 * are treated as absent by useCachedChart — the next fetch will overwrite.
 *
 * Change is a code-review checkpoint. Bump in the same PR that updates the
 * chart engine's response shape, and note it in apps/app/vibe/PROJECT.md.
 */
export const CHART_CACHE_VERSION = "2026-07-13"

const newId = (): string =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

// Same MMKV adapter shape used by subscriptionStore.ts:72.
const mmkvStorage = {
  getItem: async (name: string) => {
    const value = storage.load(name)
    return value ? JSON.stringify(value) : null
  },
  setItem: async (name: string, value: string) => {
    storage.save(name, JSON.parse(value))
  },
  removeItem: async (name: string) => {
    storage.remove(name)
  },
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      profiles: [],
      activeProfileId: null,

      setPrimary: (input) => {
        const existing = get().profiles.find((p) => p.isPrimary)
        if (existing) {
          set((state) => ({
            profiles: state.profiles.map((p) =>
              p.id === existing.id ? { ...p, ...input } : p,
            ),
          }))
          return existing.id
        }
        const id = newId()
        const profile: Profile = {
          ...input,
          id,
          createdAt: Date.now(),
          isPrimary: true,
        }
        set((state) => ({
          profiles: [...state.profiles, profile],
          activeProfileId: state.activeProfileId ?? id,
        }))
        return id
      },

      addRelation: (input) => {
        const id = newId()
        const profile: Profile = {
          name: input.name,
          date: input.date,
          time: input.time,
          location: input.location,
          id,
          createdAt: Date.now(),
          isPrimary: false,
          relationship: input.relationship,
        }
        set((state) => ({
          profiles: [...state.profiles, profile],
        }))
        return id
      },

      update: (id, patch) => {
        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.id === id ? { ...p, ...patch } : p,
          ),
        }))
      },

      remove: (id) => {
        const target = get().profiles.find((p) => p.id === id)
        if (!target || target.isPrimary) return false
        set((state) => {
          const profiles = state.profiles.filter((p) => p.id !== id)
          // If we removed the active profile, prefer the primary as the new
          // active; fall back to the first remaining, or null.
          const activeProfileId =
            state.activeProfileId === id
              ? (profiles.find((p) => p.isPrimary)?.id ??
                profiles[0]?.id ??
                null)
              : state.activeProfileId
          return { profiles, activeProfileId }
        })
        return true
      },

      setActive: (id) => {
        set({ activeProfileId: id })
      },

      cacheChart: (id, response: ChartResponse) => {
        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.id === id
              ? {
                  ...p,
                  cachedChart: {
                    response,
                    version: CHART_CACHE_VERSION,
                    fetchedAt: Date.now(),
                  },
                }
              : p,
          ),
        }))
      },
    }),
    {
      // Storage key bumped when the store's shape changed (dropping "self"
      // from Relationship, adding isPrimary + cachedChart). Old key is
      // orphaned in MMKV so any Phase-1 test data is dropped cleanly.
      name: "profiles-storage-v2",
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
)

// =============================================================================
// Selectors
// =============================================================================

/** The profile the app is currently showing charts for, or null. */
export const useActiveProfile = (): Profile | null =>
  useProfileStore(
    (s) => s.profiles.find((p) => p.id === s.activeProfileId) ?? null,
  )

/** The user's own profile (the singular one with isPrimary=true), or null. */
export const usePrimaryProfile = (): Profile | null =>
  useProfileStore((s) => s.profiles.find((p) => p.isPrimary) ?? null)

/**
 * The cached chart for a profile, if any AND if its cache tag matches
 * CHART_CACHE_VERSION. Returns null when the cache is absent or from an
 * older payload schema. Screens should feed the returned value into
 * useChart({ initialData }) so the render is instant and the network call
 * still happens in the background.
 */
export const useCachedChart = (
  profileId: string | null,
): ChartResponse | null =>
  useProfileStore((s) => {
    if (!profileId) return null
    const profile = s.profiles.find((p) => p.id === profileId)
    if (!profile?.cachedChart) return null
    if (profile.cachedChart.version !== CHART_CACHE_VERSION) return null
    return profile.cachedChart.response
  })
