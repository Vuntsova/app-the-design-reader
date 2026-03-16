/**
 * App Constants
 *
 * Centralized constants used throughout the app
 */

import Constants from "expo-constants"

function readEnvNumber(key: string, fallback: number): number {
  const raw =
    process.env[`EXPO_PUBLIC_${key.toUpperCase()}`] ??
    (Constants.expoConfig?.extra?.[key] as string | undefined)
  if (!raw) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/**
 * API Configuration
 */
export const API_CONFIG = {
  TIMEOUT: readEnvNumber("api_timeout", 30000), // 30 seconds default, override with EXPO_PUBLIC_API_TIMEOUT
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
} as const

/**
 * Storage Keys
 */
export const STORAGE_KEYS = {
  AUTH_TOKEN: "auth_token",
  USER_PREFERENCES: "user_preferences",
  ONBOARDING_COMPLETED: "onboarding_completed",
  THEME_MODE: "theme_mode",
} as const

/**
 * Navigation Routes
 */
export const ROUTES = {
  // Auth
  ONBOARDING: "Onboarding",
  WELCOME: "Welcome",
  LOGIN: "Login",
  REGISTER: "Register",
  FORGOT_PASSWORD: "ForgotPassword",

  // Main
  STARTER: "Starter",
  PROFILE: "Profile",
  PAYWALL: "Paywall",
  SETTINGS: "Settings",

  // Dev
  DEMO: "Demo",
} as const

/**
 * Analytics Events
 */
export const ANALYTICS_EVENTS = {
  // Auth
  SIGN_IN: "sign_in",
  SIGN_UP: "sign_up",
  SIGN_OUT: "sign_out",
  FORGOT_PASSWORD: "forgot_password",

  // Onboarding
  ONBOARDING_STARTED: "onboarding_started",
  ONBOARDING_COMPLETED: "onboarding_completed",
  ONBOARDING_SKIPPED: "onboarding_skipped",

  // Subscription
  PAYWALL_VIEWED: "paywall_viewed",
  SUBSCRIPTION_STARTED: "subscription_started",
  SUBSCRIPTION_COMPLETED: "subscription_completed",
  SUBSCRIPTION_CANCELLED: "subscription_cancelled",
  RESTORE_PURCHASES: "restore_purchases",

  // Errors
  ERROR_OCCURRED: "error_occurred",
  API_ERROR: "api_error",
  NETWORK_ERROR: "network_error",
} as const

/**
 * Subscription Tiers
 */
export const SUBSCRIPTION_TIERS = {
  FREE: "free",
  PRO: "pro",
} as const

/**
 * Error Messages
 */
export const ERROR_MESSAGES = {
  NETWORK_ERROR: "Unable to connect. Please check your internet connection.",
  AUTH_ERROR: "Authentication failed. Please try again.",
  UNKNOWN_ERROR: "Something went wrong. Please try again.",
  VALIDATION_ERROR: "Please check your input and try again.",
} as const

/**
 * Timing Constants
 */
export const TIMING = {
  DEBOUNCE_DELAY: 300,
  TOAST_DURATION: 3000,
  ANIMATION_DURATION: 300,
  SPLASH_SCREEN_DELAY: 1000,
  SECOND_MS: 1000,
  MINUTE_MS: 60 * 1000,
  HOUR_MS: 60 * 60 * 1000,
  COUNTDOWN_RESEND_EMAIL: 60, // seconds
  SUCCESS_MESSAGE_DURATION: 5000, // 5 seconds
  RETRY_DELAY_NETWORK: 1000,
  RETRY_DELAY_SERVER: 2000,
} as const

/**
 * Polling Intervals
 */
export const POLLING = {
  EMAIL_VERIFICATION_INTERVAL: 3000, // 3 seconds
  EMAIL_VERIFICATION_PAUSE_AFTER_RESEND: 5000, // 5 seconds
} as const

/**
 * Animation Constants
 */
export const ANIMATION = {
  STAGGER_DELAY: 100, // Base delay for staggered animations
  DURATION_QUICK: 300,
  DURATION_NORMAL: 400,
  SPRING_DAMPING: 15,
  SPRING_STIFFNESS: 400,
} as const

/**
 * Rate Limiting Configuration
 */
export const RATE_LIMIT = {
  WINDOW_AUTH_MS: 15 * 60 * 1000, // 15 minutes
  WINDOW_PASSWORD_RESET_MS: 60 * 60 * 1000, // 1 hour
  WINDOW_SIGNUP_MS: 60 * 60 * 1000, // 1 hour
  MAX_ATTEMPTS_AUTH: 5,
  MAX_ATTEMPTS_PASSWORD_RESET: 3,
  MAX_ATTEMPTS_SIGNUP: 3,
} as const

/**
 * Authentication Constants
 */
export const AUTH = {
  EMAIL_CONFIRMATION_REQUIRED: true,
  SESSION_REFRESH_THRESHOLD: 300, // seconds before expiry
} as const

/**
 * Validation Rules
 */
export const VALIDATION = {
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 128,
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
} as const

/**
 * UI Constants
 */
export const UI = {
  MAX_CONTENT_WIDTH: 600,
  HEADER_HEIGHT: 60,
  TAB_BAR_HEIGHT: 80,
} as const
