import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { searchPlaces, type GeocodeResult } from "@/services/geocode"

// Small local debounce so callers pass raw user input; the hook owns the
// timing contract. 300ms is standard for as-you-type search — long enough to
// avoid flooding LocationIQ with a request per keystroke, short enough that
// the dropdown feels live.
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export const geocodeKeys = {
  all: ["geocode"] as const,
  search: (q: string) => [...geocodeKeys.all, "search", q] as const,
}

const DEBOUNCE_MS = 300
const MIN_QUERY_LENGTH = 2

export function useGeocodeSearch(query: string) {
  const debounced = useDebouncedValue(query.trim(), DEBOUNCE_MS)
  return useQuery<GeocodeResult[]>({
    queryKey: geocodeKeys.search(debounced),
    queryFn: () => searchPlaces(debounced),
    // Below MIN_QUERY_LENGTH the engine returns [] anyway — skip the roundtrip.
    enabled: debounced.length >= MIN_QUERY_LENGTH,
    // Place suggestions don't drift within a session.
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}
