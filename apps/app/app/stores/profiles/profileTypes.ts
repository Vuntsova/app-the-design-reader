import type { ChartResponse } from "@/services/chart"

/**
 * The three relationship categories a non-primary profile can carry.
 * "self" is intentionally NOT here — self is not a relationship, it's the
 * reference point every other relationship is measured against. The single
 * primary profile is identified by isPrimary=true on the Profile record.
 */
export type Relationship = "partner" | "friend" | "child"

/**
 * Birth data fields that come off the BirthData form. These are the only
 * fields callers pass to setPrimary / addRelation; ids, timestamps, and the
 * isPrimary flag are set by the store.
 */
export interface BirthData {
  name: string
  date: string      // YYYY-MM-DD, local wall-clock
  time: string      // HH:MM (24h), local wall-clock
  location: string  // display_name from /geocode (passes ALLOWED_PLACE_PAIRS)
}

/**
 * A chart response cached alongside a profile. `version` is compared against
 * CHART_CACHE_VERSION on read; if it doesn't match, the cache is treated as
 * empty so the next useChart() call refetches.
 */
export interface CachedChart {
  response: ChartResponse
  version: string
  fetchedAt: number
}

export interface Profile extends BirthData {
  id: string
  createdAt: number
  /**
   * Exactly zero or one profile has this true. The primary profile represents
   * the app user themselves and cannot be deleted or duplicated. Enforced by
   * the store, not the type.
   */
  isPrimary: boolean
  /**
   * Only meaningful when isPrimary is false. Undefined on the primary
   * profile because "self" is not a relationship.
   */
  relationship?: Relationship
  /**
   * Optional persisted chart response. Populated by the store's cacheChart
   * action, read by useCachedChart. Absent until a chart has been fetched
   * for this profile at least once.
   */
  cachedChart?: CachedChart
}

export interface ProfileState {
  profiles: Profile[]
  activeProfileId: string | null

  /**
   * Create or update the primary profile. Idempotent. Returns the primary's id.
   * If no primary exists, creates one and (if nothing was previously active)
   * makes it active. If a primary exists, updates its birth data in place.
   */
  setPrimary: (input: BirthData) => string

  /**
   * Create a non-primary profile with the given relationship. Returns the new id.
   * Does not change activeProfileId — the caller (usually a screen right after
   * a form submission) can set it explicitly if it wants to switch context.
   */
  addRelation: (input: BirthData & { relationship: Relationship }) => string

  /**
   * Update the birth-data fields of any profile (primary or relation).
   * Cannot change isPrimary or relationship — those are set at creation and
   * fixed for the profile's lifetime.
   */
  update: (id: string, patch: Partial<BirthData>) => void

  /**
   * Remove a profile. No-ops on the primary and returns false; returns true
   * on any other successful removal. If the removed profile was active, the
   * primary is promoted (falls back to profiles[0] or null).
   */
  remove: (id: string) => boolean

  setActive: (id: string | null) => void

  /**
   * Persist a chart response against a profile. Tags it with the current
   * CHART_CACHE_VERSION so a stale schema is dropped on read.
   */
  cacheChart: (id: string, response: ChartResponse) => void
}
