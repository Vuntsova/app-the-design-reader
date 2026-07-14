import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"

import { getChart, type ChartRequest, type ChartResponse } from "@/services/chart"
import {
  CHART_CACHE_VERSION,
  useCachedChart,
  useProfileStore,
} from "@/stores/profiles"

// A birth chart is a pure function of {date, time, location}. `name` is
// echoed back in the response but does not affect the calculation, so it
// stays out of the cache key — renaming a profile must not trigger a refetch.
export const chartKeys = {
  all: ["chart"] as const,
  detail: (r: Pick<ChartRequest, "date" | "time" | "location">) =>
    [...chartKeys.all, "detail", r.date, r.time, r.location] as const,
}

/**
 * Fetch a chart for the given birth-data request.
 *
 * When `profileId` is provided, this hook does two things on top of the
 * network fetch:
 *   1. Reads that profile's persisted cached chart (MMKV) and uses it as
 *      React Query's `initialData` so the render is instant on cold start
 *      and works offline.
 *   2. Writes the response back to the profile's cache when the network
 *      fetch succeeds, tagged with the current CHART_CACHE_VERSION.
 *
 * When `profileId` is absent the hook behaves exactly like before — network
 * fetch, no persistence. That's the shape callers use before a profile has
 * been created (BirthData form during first-time entry, for example).
 */
export function useChart(
  request: ChartRequest | undefined,
  profileId?: string | null,
) {
  const cached = useCachedChart(profileId ?? null)
  const cacheChart = useProfileStore((s) => s.cacheChart)

  const query = useQuery<ChartResponse>({
    queryKey: request ? chartKeys.detail(request) : chartKeys.all,
    queryFn: () => {
      if (!request) {
        throw new Error("useChart called without a request")
      }
      return getChart(request)
    },
    // If we have a version-matched cache for this profile, seed the query
    // with it. React Query treats initialData as fresh (with our staleTime
    // set to Infinity below), so the network fetch is skipped entirely when
    // the cache is valid. On version mismatch, useCachedChart returns null,
    // initialData is undefined, and the query fetches normally.
    initialData: cached ?? undefined,
    enabled: Boolean(request?.date && request?.time && request?.location),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  // Persist fresh responses back to the profile. Skip when data came from
  // the persisted cache (same object reference) — no need to re-write.
  useEffect(() => {
    if (!query.data || !profileId) return
    if (query.data === cached) return
    cacheChart(profileId, query.data)
  }, [query.data, cached, profileId, cacheChart])

  return query
}
