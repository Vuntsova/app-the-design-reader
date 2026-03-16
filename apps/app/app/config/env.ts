/**
 * Environment Configuration
 *
 * Type-safe access to environment variables with validation.
 * Supports multiple backend providers (Supabase, Convex).
 */

import Constants from "expo-constants"
import { z } from "zod"

import { logger } from "../utils/Logger"

const readRawEnv = (key: string): string | undefined => {
  return (
    process.env[`EXPO_PUBLIC_${key.toUpperCase()}`] ??
    (Constants.expoConfig?.extra?.[key] as string | undefined)
  )
}

const readStringEnv = (key: string): string | undefined => {
  const value = readRawEnv(key)
  if (!value) return undefined
  const trimmed = String(value).trim()
  return trimmed.length > 0 ? trimmed : undefined
}

const readBooleanEnv = (key: string): boolean | undefined => {
  const value = readStringEnv(key)
  if (!value) return undefined
  const normalized = value.toLowerCase()
  if (["true", "1", "yes", "on"].includes(normalized)) return true
  if (["false", "0", "no", "off"].includes(normalized)) return false
  return undefined
}

const fallbackAppEnv = __DEV__ ? "development" : "production"
const appEnvValue = readStringEnv("app_env")
const resolvedAppEnv =
  appEnvValue === "development" || appEnvValue === "staging" || appEnvValue === "production"
    ? appEnvValue
    : fallbackAppEnv

// Determine backend provider from env
const backendProviderValue = readStringEnv("backend_provider")?.toLowerCase()
const resolvedBackendProvider = backendProviderValue === "convex" ? "convex" : "supabase"

const EnvSchema = z
  .object({
    // Backend Provider Selection
    backendProvider: z.enum(["supabase", "convex"]).default("supabase"),

    // Supabase (only required when backendProvider is "supabase")
    supabaseUrl: z.string().url().optional(),
    supabasePublishableKey: z.string().optional(),

    // Convex (only required when backendProvider is "convex")
    convexUrl: z.string().url().optional(),

    // RevenueCat
    revenueCatIosKey: z.string().optional(),
    revenueCatAndroidKey: z.string().optional(),
    revenueCatWebKey: z.string().optional(),

    // PostHog
    posthogApiKey: z.string().optional(),
    posthogHost: z.string().url().optional().default("https://app.posthog.com"),

    // Sentry
    sentryDsn: z.string().optional(),

    // Google OAuth
    googleClientId: z.string().optional(),
    googleIosClientId: z.string().optional(),

    // Apple Sign-In (public identifiers only - private key goes in backend dashboard)
    appleServicesId: z.string().optional(),
    appleTeamId: z.string().optional(),

    // Optional flags
    enableWidgets: z.boolean().default(false),
    useMockNotifications: z.boolean().default(false),
    enableCertificatePinning: z.boolean().default(false),
    certificatePins: z.string().optional(),
    emailRedirectUrl: z.string().url().optional(),
    passwordResetRedirectUrl: z.string().url().optional(),

    // App
    appEnv: z.enum(["development", "staging", "production"]).default(resolvedAppEnv),
    appVersion: z.string().min(1),
  })
  .superRefine((values, ctx) => {
    if (values.appEnv !== "production") return

    // Validate based on selected backend provider
    if (values.backendProvider === "supabase") {
      const required = [
        ["supabaseUrl", values.supabaseUrl],
        ["supabasePublishableKey", values.supabasePublishableKey],
      ] as const

      required.forEach(([key, value]) => {
        if (!value) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${key} is required in production when using Supabase`,
            path: [key],
          })
        }
      })
    } else if (values.backendProvider === "convex") {
      if (!values.convexUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "convexUrl is required in production when using Convex",
          path: ["convexUrl"],
        })
      }
    }

    if (values.enableCertificatePinning && !values.certificatePins) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "certificatePins is required in production when enableCertificatePinning is true",
        path: ["certificatePins"],
      })
    }
  })

export type EnvConfig = z.infer<typeof EnvSchema>

const envInput: Partial<EnvConfig> = {
  // Backend provider
  backendProvider: resolvedBackendProvider,

  // Supabase
  supabaseUrl: readStringEnv("supabase_url"),
  supabasePublishableKey: readStringEnv("supabase_publishable_key"),

  // Convex
  convexUrl: readStringEnv("convex_url"),

  // RevenueCat
  revenueCatIosKey: readStringEnv("revenuecat_ios_key"),
  revenueCatAndroidKey: readStringEnv("revenuecat_android_key"),
  revenueCatWebKey: readStringEnv("revenuecat_web_key"),
  posthogApiKey: readStringEnv("posthog_api_key"),
  posthogHost: readStringEnv("posthog_host"),
  sentryDsn: readStringEnv("sentry_dsn"),
  googleClientId: readStringEnv("google_client_id"),
  googleIosClientId: readStringEnv("google_ios_client_id"),
  appleServicesId: readStringEnv("apple_services_id"),
  appleTeamId: readStringEnv("apple_team_id"),
  enableWidgets: readBooleanEnv("enable_widgets"),
  useMockNotifications: readBooleanEnv("use_mock_notifications"),
  enableCertificatePinning: readBooleanEnv("enable_certificate_pinning"),
  certificatePins: readStringEnv("certificate_pins"),
  emailRedirectUrl: readStringEnv("email_redirect_url"),
  passwordResetRedirectUrl: readStringEnv("password_reset_redirect_url"),
  appEnv: resolvedAppEnv,
  appVersion: Constants.expoConfig?.version || "1.0.0",
}

const parsedEnv = EnvSchema.safeParse(envInput)

if (!parsedEnv.success) {
  const issues = parsedEnv.error.issues
  const missingList = issues.map((issue) => issue.path.join(".")).join(", ")

  if (resolvedAppEnv === "production") {
    throw new Error(
      `Environment validation failed in production. Missing or invalid: ${missingList}. ` +
        `Details: ${issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    )
  }

  // In development/staging, log a clear warning with full details
  logger.warn("[EnvConfig] Validation failed, using fallback values", {
    issues: issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  })
}

const env: EnvConfig = parsedEnv.success
  ? parsedEnv.data
  : {
      ...envInput,
      backendProvider: resolvedBackendProvider,
      appEnv: resolvedAppEnv,
      appVersion: Constants.expoConfig?.version || "1.0.0",
      posthogHost: envInput.posthogHost || "https://app.posthog.com",
      enableWidgets: envInput.enableWidgets ?? false,
      useMockNotifications: envInput.useMockNotifications ?? false,
      enableCertificatePinning: envInput.enableCertificatePinning ?? false,
    }

const validationIssues = parsedEnv.success ? [] : parsedEnv.error.issues

export const envValidation = {
  isValid: validationIssues.length === 0,
  issues: validationIssues,
  missing: validationIssues.map((issue) => issue.path.join(".")),
  warnings: [],
}

export { env }

export const isDevelopment = env.appEnv === "development"
export const isProduction = env.appEnv === "production"
export const isStaging = env.appEnv === "staging"

// Backend provider helpers
export const isSupabase = env.backendProvider === "supabase"
export const isConvex = env.backendProvider === "convex"

export function isServiceConfigured(
  service:
    | "supabase"
    | "convex"
    | "revenuecat"
    | "posthog"
    | "sentry"
    | "google"
    | "apple"
    | "backend",
): boolean {
  switch (service) {
    case "backend":
      // Check if the selected backend is properly configured
      if (env.backendProvider === "supabase") {
        return !!(env.supabaseUrl && env.supabasePublishableKey)
      }
      return !!env.convexUrl
    case "supabase":
      return !!(env.supabaseUrl && env.supabasePublishableKey)
    case "convex":
      return !!env.convexUrl
    case "revenuecat":
      return !!(env.revenueCatIosKey || env.revenueCatAndroidKey || env.revenueCatWebKey)
    case "posthog":
      return !!env.posthogApiKey
    case "sentry":
      return !!env.sentryDsn
    case "google":
      return !!env.googleClientId
    case "apple":
      return !!(env.appleServicesId && env.appleTeamId)
    default:
      return false
  }
}

export function logEnvValidation(): void {
  if (!envValidation.isValid) {
    logger.error("Environment configuration is invalid", {
      issues: envValidation.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    })
  }

  if (envValidation.warnings.length > 0 && __DEV__) {
    logger.warn("Environment configuration warnings", {
      warnings: envValidation.warnings,
    })
  }
}
