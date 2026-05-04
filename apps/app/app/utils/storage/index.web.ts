import { useCallback, useEffect, useState } from "react"

// Web-compatible localStorage wrapper with MMKV-like interface.
// Mirrors the subset of the MMKV API the app actually uses.
const webStorage = {
  getString: (key: string) => localStorage.getItem(key) ?? undefined,
  set: (key: string, value: string) => localStorage.setItem(key, value),
  delete: (key: string) => localStorage.removeItem(key),
  clearAll: () => localStorage.clear(),
  getAllKeys: () => Object.keys(localStorage),
  // Stub for MMKV-specific methods that aren't available on web
  addOnValueChangedListener: () => ({ remove: () => {} }),
}

export const storage = webStorage

/**
 * localStorage-backed equivalent of `useMMKVString` for the web build.
 * Same signature as the native version so consumers don't branch on platform.
 */
export function useMMKVString(
  key: string,
  _instance?: typeof storage,
): [string | undefined, (value: string | undefined) => void] {
  const [value, setValue] = useState<string | undefined>(() => {
    const stored = localStorage.getItem(key)
    return stored ?? undefined
  })

  const setStoredValue = useCallback(
    (newValue: string | undefined) => {
      if (newValue === undefined) {
        localStorage.removeItem(key)
      } else {
        localStorage.setItem(key, newValue)
      }
      setValue(newValue)
    },
    [key],
  )

  // Listen for storage changes from other tabs/windows
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key) {
        setValue(e.newValue ?? undefined)
      }
    }
    window.addEventListener("storage", handleStorageChange)
    return () => window.removeEventListener("storage", handleStorageChange)
  }, [key])

  return [value, setStoredValue]
}

/**
 * Loads a string from storage.
 *
 * @param key The key to fetch.
 */
export function loadString(key: string): string | null {
  try {
    return storage.getString(key) ?? null
  } catch {
    return null
  }
}

/**
 * Saves a string to storage.
 *
 * @param key The key to fetch.
 * @param value The value to store.
 */
export function saveString(key: string, value: string): boolean {
  try {
    storage.set(key, value)
    return true
  } catch {
    return false
  }
}

/**
 * Loads something from storage and runs it thru JSON.parse.
 *
 * @param key The key to fetch.
 */
export function load<T>(key: string): T | null {
  let almostThere: string | null = null
  try {
    almostThere = loadString(key)
    return JSON.parse(almostThere ?? "") as T
  } catch {
    return (almostThere as T) ?? null
  }
}

/**
 * Saves an object to storage.
 *
 * @param key The key to fetch.
 * @param value The value to store.
 */
export function save(key: string, value: unknown): boolean {
  try {
    saveString(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

/**
 * Removes something from storage.
 *
 * @param key The key to kill.
 */
export function remove(key: string): void {
  try {
    storage.delete(key)
  } catch {}
}

/**
 * Burn it all to the ground.
 */
export function clear(): void {
  try {
    storage.clearAll()
  } catch {}
}
