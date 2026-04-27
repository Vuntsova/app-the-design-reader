/**
 * Web secure storage utility.
 *
 * For browser builds, sensitive auth values are stored in sessionStorage to
 * avoid long-lived token persistence across browser restarts.
 *
 * NOTE: Browser storage is still readable by JavaScript in the page context.
 * For high-sensitivity apps, prefer server-managed sessions with HTTP-only cookies.
 */

const PREFIX = "secure_"
const LEGACY_KEY = "shipnative_secure_storage_key_2024"

function getSessionStorage(): Storage | null {
  if (typeof sessionStorage === "undefined") return null
  try {
    return sessionStorage
  } catch {
    return null
  }
}

function getLocalStorage(): Storage | null {
  if (typeof localStorage === "undefined") return null
  try {
    return localStorage
  } catch {
    return null
  }
}

function safeBase64Decode(value: string): string | null {
  try {
    return atob(value)
  } catch {
    return null
  }
}

/**
 * Legacy deobfuscation support for seamless migration from previous versions.
 */
function deobfuscateLegacyValue(obfuscated: string): string | null {
  const decoded = safeBase64Decode(obfuscated)
  if (!decoded) return null

  let result = ""
  for (let i = 0; i < decoded.length; i += 1) {
    const charCode = decoded.charCodeAt(i) ^ LEGACY_KEY.charCodeAt(i % LEGACY_KEY.length)
    result += String.fromCharCode(charCode)
  }
  return result
}

function prefixed(key: string): string {
  return `${PREFIX}${key}`
}

let hasWarnedSessionStorage = false

export const webSecureStorage = {
  setItem(key: string, value: string): void {
    const session = getSessionStorage()
    const local = getLocalStorage()
    const target = session ?? local
    const storageKey = prefixed(key)

    if (!target) return

    if (!session && local && !hasWarnedSessionStorage) {
      hasWarnedSessionStorage = true
      // Security tradeoff: sessionStorage was unavailable (e.g. private browsing
      // restrictions, sandboxed iframe), so we fall back to localStorage to keep
      // auth functional. This means tokens persist across browser restarts on
      // this device until explicit sign-out. Surfaced via console.error and a
      // global flag so auth code can detect the degraded mode and warn users.
      ;(globalThis as { __shipnativeStorageFallback?: boolean }).__shipnativeStorageFallback = true
      console.error(
        "[webSecureStorage] sessionStorage unavailable, falling back to localStorage. " +
          "Auth tokens will persist across browser restarts on this device.",
      )
    }

    try {
      target.setItem(storageKey, value)
      // If sessionStorage is available, avoid long-lived local persistence.
      if (session) {
        local?.removeItem(storageKey)
      }
    } catch {
      // Ignore write failures and keep app functional.
    }
  },

  getItem(key: string): string | null {
    const session = getSessionStorage()
    const local = getLocalStorage()
    const storageKey = prefixed(key)

    try {
      const primaryStorage = session ?? local
      if (!primaryStorage) return null

      if (!session && local && !hasWarnedSessionStorage) {
        hasWarnedSessionStorage = true
        // Security tradeoff: see setItem for full context. We keep the fallback
        // path readable so existing sessions don't get logged out, but flag
        // loudly so callers can notice the degraded storage mode.
        ;(globalThis as { __shipnativeStorageFallback?: boolean }).__shipnativeStorageFallback =
          true
        console.error(
          "[webSecureStorage] sessionStorage unavailable, reading from localStorage fallback.",
        )
      }

      const current = primaryStorage.getItem(storageKey)
      if (current) return current

      // Migration path from legacy localStorage obfuscation.
      const legacy = local?.getItem(storageKey)
      if (!legacy) return null

      const migrated = deobfuscateLegacyValue(legacy) ?? legacy
      primaryStorage.setItem(storageKey, migrated)
      if (session) {
        local?.removeItem(storageKey)
      }
      return migrated
    } catch {
      return null
    }
  },

  removeItem(key: string): void {
    const session = getSessionStorage()
    const local = getLocalStorage()
    const storageKey = prefixed(key)

    try {
      session?.removeItem(storageKey)
      local?.removeItem(storageKey)
    } catch {
      // Ignore remove failures and keep app functional.
    }
  },
}

/**
 * Returns true when secure storage is running in degraded mode (localStorage
 * fallback because sessionStorage was unavailable). Auth code can read this
 * to surface a breadcrumb or warn the user that tokens persist across
 * browser restarts on this device.
 */
export function isStorageDegraded(): boolean {
  return !!(globalThis as { __shipnativeStorageFallback?: boolean }).__shipnativeStorageFallback
}
