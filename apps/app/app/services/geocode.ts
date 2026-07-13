// Client for the /geocode place-search endpoint on the chart engine.
// Mirrors services/chart.ts. Endpoint contract: main.py:159 in dtt-chart-api.
//
// The engine server-side filters results by the same ALLOWED_PLACE_PAIRS set
// that /chart validates against. So anything this returns is guaranteed to
// pass /chart's validation — the app's job is to make the user pick one and
// never send free text.

const GEOCODE_ENDPOINT = "https://dtt-chart.onrender.com/geocode"

export interface GeocodeResult {
  display_name: string
  lat: number
  lng: number
}

interface GeocodeResponse {
  results: GeocodeResult[]
}

export class GeocodeApiError extends Error {
  readonly status: number
  readonly body: string

  constructor(status: number, body: string) {
    super(`Geocode engine returned ${status}: ${body}`)
    this.name = "GeocodeApiError"
    this.status = status
    this.body = body
  }
}

export async function searchPlaces(query: string): Promise<GeocodeResult[]> {
  const url = `${GEOCODE_ENDPOINT}?q=${encodeURIComponent(query)}`
  const response = await fetch(url, { method: "GET" })

  if (!response.ok) {
    const body = await response.text()
    throw new GeocodeApiError(response.status, body)
  }

  const data = (await response.json()) as GeocodeResponse
  return data.results ?? []
}
