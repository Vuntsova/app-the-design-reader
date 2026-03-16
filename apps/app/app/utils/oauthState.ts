/**
 * OAuth state helpers.
 *
 * Keeps state in sessionStorage on web for CSRF protection during OAuth callbacks.
 * Falls back to in-memory storage on native or when storage is unavailable.
 */

const OAUTH_STATE_STORAGE_KEY = "shipnative.oauth.state"
let inMemoryOAuthState: string | null = null

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
  if (typeof sessionStorage !== "undefined") {
    try {
      sessionStorage.setItem(OAUTH_STATE_STORAGE_KEY, state)
      inMemoryOAuthState = state
      return
    } catch {
      // Fall through to in-memory fallback
    }
  }
  inMemoryOAuthState = state
}

function clearStoredState(): void {
  if (typeof sessionStorage !== "undefined") {
    try {
      sessionStorage.removeItem(OAUTH_STATE_STORAGE_KEY)
    } catch {
      // Ignore storage errors and clear in-memory fallback below.
    }
  }
  inMemoryOAuthState = null
}

/**
 * Atomically read and clear the stored state in a single operation.
 * Prevents any possibility of the state being read without being cleared.
 */
function consumeStoredState(): string | null {
  const state = readStoredState()
  clearStoredState()
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
