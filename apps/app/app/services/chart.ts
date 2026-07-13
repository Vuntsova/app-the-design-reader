// Client for the verified chart engine at https://dtt-chart.onrender.com.
// The engine is the source of truth for every HD calculation. The app never
// derives type, authority, gates, channels, or planetary positions in TS.
//
// The payload shape mirrors the live response documented in PROJECT.md
// (verified 2026-07-12). Do NOT add color / tone / base / variables /
// incarnation_cross / definition — the engine does not compute them, and
// fabricating them here is exactly the failure mode PROJECT.md warns against.

const CHART_ENDPOINT = "https://dtt-chart.onrender.com/chart"

export type HDType =
  | "Manifestor"
  | "Generator"
  | "Manifesting Generator"
  | "Projector"
  | "Reflector"

export type Center =
  | "Head"
  | "Ajna"
  | "Throat"
  | "G"
  | "Heart"
  | "Sacral"
  | "Spleen"
  | "Solar Plexus"
  | "Root"

// Node keys are exactly "N. Node" and "S. Node" (dot-space). The legacy
// "NorthNode" / "SouthNode" aliases belonged to an older engine version that
// is not deployed — verified against the live endpoint 2026-07-13.
export type Body =
  | "Sun"
  | "Earth"
  | "N. Node"
  | "S. Node"
  | "Moon"
  | "Mercury"
  | "Venus"
  | "Mars"
  | "Jupiter"
  | "Saturn"
  | "Uranus"
  | "Neptune"
  | "Pluto"

export interface PlanetaryActivation {
  degree: number
  gate: number
  line: number
}

export type ActiveChannel = [number, number]

export interface ChartRequest {
  date: string
  time: string
  location: string
  name?: string
}

// Server-echoed request in the response. The engine normalizes an omitted
// `name` to `null`, so this shape is not identical to what a client sends.
export interface ChartInputEcho {
  date: string
  time: string
  location: string
  name: string | null
}

// `birth_info.input` is the raw location string the user typed
// (e.g. "Seoul"). `resolved_name` is the LocationIQ-normalized form
// (e.g. "Seoul, South Korea"). Verified against the live endpoint 2026-07-13.
export interface BirthInfo {
  input: string
  resolved_name: string
  lat: number
  lng: number
  timezone: string
  utc_offset_hours: number
}

export interface Chart {
  type: HDType
  // Type-specific strategy, e.g. "To Inform". Full enum not documented at the
  // API level — kept as string rather than fabricated.
  strategy: string
  // Full authority string, e.g. "Emotional (Solar Plexus)", "Sacral", "Splenic".
  // Seven cascade positions exist (see PROJECT.md); exact API strings for the
  // rare ones are not documented, so this stays `string`, not a partial union.
  authority: string
  // "line1/line2", e.g. "6/2". Derived by the engine from personality/design Sun.
  profile: string
  signature: string
  not_self_theme: string
  defined_centers: Center[]
  undefined_centers: Center[]
  active_channels: ActiveChannel[]
  // Deduplicated. To know which side (personality/design) activated a gate,
  // read from the maps below, not this list.
  active_gates: number[]
  personality: Record<Body, PlanetaryActivation>
  design: Record<Body, PlanetaryActivation>
}

export interface ChartResponse {
  input: ChartInputEcho
  birth_info: BirthInfo
  chart: Chart
}

// A 400 usually means the place name failed the engine's ALLOWED_PLACE_PAIRS
// validation (never let the user type free-hand — use autocomplete upstream).
// A 503 usually means LOCATIONIQ_KEY is unset on the engine.
export class ChartApiError extends Error {
  readonly status: number
  readonly body: string

  constructor(status: number, body: string) {
    super(`Chart engine returned ${status}: ${body}`)
    this.name = "ChartApiError"
    this.status = status
    this.body = body
  }
}

export async function getChart(request: ChartRequest): Promise<ChartResponse> {
  const response = await fetch(CHART_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new ChartApiError(response.status, body)
  }

  return (await response.json()) as ChartResponse
}
