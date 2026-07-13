import { useQuery } from "@tanstack/react-query"

import { getChart, type ChartRequest, type ChartResponse } from "@/services/chart"

// A birth chart is a pure function of {date, time, location}. `name` is
// echoed back in the response but does not affect the calculation, so it
// stays out of the cache key — renaming a profile must not trigger a refetch.
export const chartKeys = {
  all: ["chart"] as const,
  detail: (r: Pick<ChartRequest, "date" | "time" | "location">) =>
    [...chartKeys.all, "detail", r.date, r.time, r.location] as const,
}

// A birth chart is timeless — the same (date, time, location) always produces
// the same activation set. Cache it forever within the session and disable
// all reactive refetching. Nothing to refresh; refetching would only spend
// LocationIQ credits.
export function useChart(request: ChartRequest | undefined) {
  return useQuery<ChartResponse>({
    queryKey: request ? chartKeys.detail(request) : chartKeys.all,
    queryFn: () => {
      if (!request) {
        throw new Error("useChart called without a request")
      }
      return getChart(request)
    },
    enabled: Boolean(request?.date && request?.time && request?.location),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}
