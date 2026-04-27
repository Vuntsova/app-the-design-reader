/**
 * OAuth state helpers.
 *
 * Keeps state in sessionStorage on web for CSRF protection during OAuth callbacks.
 * Falls back to in-memory storage on native or when storage is unavailable.
 *
 * The state is also stamped with a creation timestamp so stale callbacks
 * (e.g. user opens an OAuth tab and abandons it for hours) cannot be
 * consumed. The TTL is enforced inside `consumeOAuthState` itself so every
 * caller benefits — no separate wrapper required.
 */

const OAUTH_STATE_STORAGE_KEY = "shipnative.oauth.state"
const OAUTH_STATE_TIMESTAMP_KEY = "shipnative.oauth.state.createdAt"
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000
let inMemoryOAuthState: string | null = null
let inMemoryOAuthStateCreatedAt: number | null = null

function getRandomState(byteLength = 24): string {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(byteLength)
    globalThis.crypto.getRandomValues(bytes)
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
  }

  return Array.from({ length: byteLength * 2 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join("")
}

function readStoredState(): string | null {
  if (typeof sessionStorage !== "undefined") {
    try {
      return sessionStorage.getItem(OAUTH_STATE_STORAGE_KEY)
    } catch {
      return inMemoryOAuthState
    }
  }
  return inMemoryOAuthState
}

function writeStoredState(state: string): void {
  const timestamp = Date.now()
  if (typeof sessionStorage !== "undefined") {
    try {
      sessionStorage.setItem(OAUTH_STATE_STORAGE_KEY, state)
      sessionStorage.setItem(OAUTH_STATE_TIMESTAMP_KEY, String(timestamp))
      inMemoryOAuthState = state
      inMemoryOAuthStateCreatedAt = timestamp
      return
    } catch {
      // Fall through to in-memory fallback
    }
  }
  inMemoryOAuthState = state
  inMemoryOAuthStateCreatedAt = timestamp
}

function readStoredTimestamp(): number | null {
  if (typeof sessionStorage !== "undefined") {
    try {
      const raw = sessionStorage.getItem(OAUTH_STATE_TIMESTAMP_KEY)
      if (raw) {
        const parsed = Number(raw)
        if (Number.isFinite(parsed)) return parsed
      }
    } catch {
      // Fall through to in-memory.
    }
  }
  return inMemoryOAuthStateCreatedAt
}

function clearStoredState(): void {
  if (typeof sessionStorage !== "undefined") {
    try {
      sessionStorage.removeItem(OAUTH_STATE_STORAGE_KEY)
      sessionStorage.removeItem(OAUTH_STATE_TIMESTAMP_KEY)
    } catch {
      // Ignore storage errors and clear in-memory fallback below.
    }
  }
  inMemoryOAuthState = null
  inMemoryOAuthStateCreatedAt = null
}

/**
 * Atomically read and clear the stored state in a single operation.
 * Prevents any possibility of the state being read without being cleared.
 * Also enforces the TTL: states older than OAUTH_STATE_TTL_MS are dropped.
 */
function consumeStoredState(): string | null {
  const state = readStoredState()
  const createdAt = readStoredTimestamp()
  clearStoredState()
  if (!state) return null
  if (createdAt !== null && Date.now() - createdAt > OAUTH_STATE_TTL_MS) {
    return null
  }
  return state
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

export function hasPendingOAuthState(): boolean {
  return !!readStoredState()
}

export function createOAuthState(): string {
  const state = getRandomState()
  writeStoredState(state)
  return state
}

/**
 * Atomically consume (read + clear) the stored OAuth state and validate it
 * against the received state. The stored state is always cleared regardless
 * of whether validation succeeds, preventing replay attacks.
 */
export function consumeOAuthState(receivedState: string | null | undefined): boolean {
  const expectedState = consumeStoredState()

  if (!expectedState || !receivedState) {
    return false
  }

  return constantTimeEqual(expectedState, receivedState)
}

export function clearOAuthState(): void {
  clearStoredState()
}
