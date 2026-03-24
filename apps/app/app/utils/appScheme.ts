import Constants from "expo-constants"
import * as Linking from "expo-linking"

const DEFAULT_APP_SCHEME = "shipnative"

const normalizeScheme = (scheme: string | null | undefined): string | undefined => {
  if (!scheme) return undefined
  const trimmed = scheme.trim().replace(/:$/, "")
  return trimmed.length > 0 ? trimmed : undefined
}

export function getAppScheme(): string {
  const configScheme = (Constants.expoConfig as { scheme?: string | string[] } | undefined)?.scheme

  if (typeof configScheme === "string") {
    return normalizeScheme(configScheme) ?? DEFAULT_APP_SCHEME
  }

  if (Array.isArray(configScheme) && configScheme.length > 0) {
    return normalizeScheme(configScheme[0]) ?? DEFAULT_APP_SCHEME
  }

  return DEFAULT_APP_SCHEME
}

export function createAppUrl(path: string): string {
  const normalizedPath = path.replace(/^\/+/, "")
  try {
    return Linking.createURL(normalizedPath)
  } catch {
    return `${getAppScheme()}://${normalizedPath}`
  }
}
