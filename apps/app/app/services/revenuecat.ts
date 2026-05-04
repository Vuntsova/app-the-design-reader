/**
 * RevenueCat Service
 *
 * Unified subscription management for iOS, Android, and Web using RevenueCat.
 * - Mobile: Uses react-native-purchases SDK
 * - Web: Uses @revenuecat/purchases-js SDK (Web Billing)
 */

import { Platform } from "react-native"

import { env, isDevelopment } from "../config/env"
import type { PricingPackage, SubscriptionService, SubscriptionInfo } from "../types/subscription"
import { logger } from "../utils/Logger"
import { formatPeriod } from "../utils/subscriptionHelpers"
import { mockRevenueCat } from "./mocks/revenueCat"

type RevenueCatEntitlement = {
  expirationDate?: string | null
  isActive?: boolean
  productIdentifier?: string | null
  willRenew?: boolean
  periodType?: "TRIAL" | "INTRO" | "NORMAL" | "trial" | "intro" | "normal"
}

type RevenueCatCustomerInfo = {
  entitlements?: {
    active?: Record<string, RevenueCatEntitlement>
  }
  latestExpirationDate?: string | null
  managementURL?: string | null
}

type RevenueCatMobileSdk = {
  LOG_LEVEL: { DEBUG: number; INFO: number; WARN: number; ERROR: number }
  setLogLevel: (level: number) => void
  setLogHandler: (handler: (logLevel: number, message: string) => void) => void
  configure: (config: { apiKey: string }) => Promise<void> | void
  logIn: (userId: string) => Promise<{ customerInfo: RevenueCatCustomerInfo }>
  logOut: () => Promise<RevenueCatCustomerInfo>
  isAnonymous: () => Promise<boolean>
  getCustomerInfo: () => Promise<RevenueCatCustomerInfo>
  getOfferings: () => Promise<RevenueCatOfferings>
  purchasePackage: (pkg: unknown) => Promise<{ customerInfo?: RevenueCatCustomerInfo }>
  restorePurchases: () => Promise<RevenueCatCustomerInfo>
  addCustomerInfoUpdateListener: (listener: (info: RevenueCatCustomerInfo) => void) => void
  removeCustomerInfoUpdateListener: (listener: (info: RevenueCatCustomerInfo) => void) => void
}

type RevenueCatOfferings = {
  current?: {
    availablePackages: RevenueCatPackage[]
  }
}

type RevenueCatPackage = {
  identifier: string
  packageType?: string
  product: {
    title: string
    description: string
    price: number
    priceString: string
    currencyCode: string
    subscriptionPeriod?: {
      unit: "DAY" | "WEEK" | "MONTH" | "YEAR"
      value: number
    }
    introPrice?: {
      price: number
      priceString: string
      period: number
      periodUnit: "DAY" | "WEEK" | "MONTH" | "YEAR"
    } | null
    freeTrialPeriod?: {
      value: number
      unit: "DAY" | "WEEK" | "MONTH" | "YEAR"
    } | null
  }
}

type RevenueCatWebPackage = {
  identifier: string
  packageType?: string
  rcBillingProduct?: {
    displayName?: string
    description?: string
    currentPrice?: {
      amountMicros?: number
      formattedPrice?: string
      currency?: string
    }
    introductoryPrice?: {
      amountMicros?: number
      formattedPrice?: string
      periodCount?: number
      periodUnit?: "DAY" | "WEEK" | "MONTH" | "YEAR"
    } | null
    freeTrialPeriod?: {
      periodCount?: number
      periodUnit?: "DAY" | "WEEK" | "MONTH" | "YEAR"
    } | null
  }
}

type RevenueCatWebSdk = {
  Purchases: {
    configure: (config: { apiKey: string; appUserId?: string }) => RevenueCatWebInstance
  }
}

type RevenueCatWebInstance = {
  getCustomerInfo: () => Promise<RevenueCatCustomerInfo>
  getOfferings: () => Promise<RevenueCatOfferings>
  purchase: (params: { rcPackage: unknown }) => Promise<{ customerInfo: RevenueCatCustomerInfo }>
  logIn?: (userId: string) => Promise<{ customerInfo: RevenueCatCustomerInfo }>
  logOut?: () => Promise<{ customerInfo: RevenueCatCustomerInfo }>
  restorePurchases?: () => Promise<{ customerInfo: RevenueCatCustomerInfo }>
}

// API Keys
const mobileApiKey = Platform.select({
  ios: env.revenueCatIosKey,
  android: env.revenueCatAndroidKey,
})
const webApiKey = env.revenueCatWebKey

/**
 * Check if an API key is a placeholder value from .env.example
 * Placeholder values cause SDK errors instead of graceful mock mode
 */
const isPlaceholderKey = (key: string | undefined): boolean => {
  if (!key) return true
  const lowerKey = key.toLowerCase()
  return (
    lowerKey.startsWith("your-") ||
    lowerKey === "your-ios-key" ||
    lowerKey === "your-android-key" ||
    lowerKey === "your-web-key" ||
    lowerKey.includes("placeholder") ||
    lowerKey.includes("example")
  )
}

// Determine if we should use mock
const isDevEnv = __DEV__ || isDevelopment
const useMock =
  (isDevEnv && isPlaceholderKey(mobileApiKey) && Platform.OS !== "web") ||
  (isDevEnv && isPlaceholderKey(webApiKey) && Platform.OS === "web")

// SDK instances
let MobilePurchases: RevenueCatMobileSdk | null = null
let WebPurchases: RevenueCatWebSdk | null = null
let loadWebPurchasesPromise: Promise<RevenueCatWebSdk | null> | null = null

const getMobilePurchases = (): RevenueCatMobileSdk => {
  if (!MobilePurchases) {
    throw new Error("RevenueCat SDK is not available")
  }
  return MobilePurchases
}

// Track initialization state to prevent double configuration (e.g., on hot reload)
let isMobileConfigured = false
let isWebConfigured = false

// Load appropriate SDK based on platform
if (Platform.OS !== "web" && !useMock) {
  try {
    MobilePurchases = require("react-native-purchases").default as RevenueCatMobileSdk
  } catch {
    // Failed to load react-native-purchases - will use mock
  }
}

// Lazy-load RevenueCat web SDK to keep initial web bundle smaller
async function loadWebPurchasesSdk(): Promise<RevenueCatWebSdk | null> {
  if (WebPurchases) return WebPurchases
  if (loadWebPurchasesPromise) return loadWebPurchasesPromise

  loadWebPurchasesPromise = import("@revenuecat/purchases-js")
    .then((mod) => {
      WebPurchases = mod as unknown as RevenueCatWebSdk
      return WebPurchases
    })
    .catch((error) => {
      if (__DEV__) {
        logger.warn("Failed to load @revenuecat/purchases-js, will fall back to mock", { error })
      }
      return null
    })

  return loadWebPurchasesPromise
}

// Web SDK instance (singleton)
let webPurchasesInstance: RevenueCatWebInstance | null = null

/**
 * Convert RevenueCat customer info to unified SubscriptionInfo
 */
function toSubscriptionInfo(
  customerInfo: RevenueCatCustomerInfo | null,
  platform: "revenuecat" | "revenuecat-web",
): SubscriptionInfo {
  if (!customerInfo) {
    return {
      platform,
      status: "none",
      productId: null,
      expirationDate: null,
      willRenew: false,
      isActive: false,
      isTrial: false,
    }
  }

  // Check for active "pro" entitlement
  const proEntitlement = customerInfo.entitlements?.active?.pro
  const isActive = !!proEntitlement

  return {
    platform,
    status: isActive ? "active" : "none",
    productId: proEntitlement?.productIdentifier || null,
    expirationDate: proEntitlement?.expirationDate || customerInfo.latestExpirationDate || null,
    willRenew: proEntitlement?.willRenew ?? false,
    isActive,
    isTrial: proEntitlement?.periodType === "TRIAL" || proEntitlement?.periodType === "trial",
  }
}

/**
 * RevenueCat Service for Mobile (iOS/Android)
 */
const revenueCatMobile: SubscriptionService = {
  platform: "revenuecat",

  configure: async (_config?: Record<string, unknown>) => {
    if (useMock) {
      await mockRevenueCat.configure("mock-api-key")
      return
    }

    // Prevent double configuration (e.g., on hot reload)
    if (isMobileConfigured) {
      if (__DEV__) {
        logger.debug("[RevenueCat] Already configured, skipping...")
      }
      return
    }

    if (MobilePurchases && mobileApiKey) {
      // Set log level BEFORE configure (best practice per RevenueCat docs)
      // Use INFO level even in dev to reduce console spam - DEBUG is very verbose
      MobilePurchases.setLogLevel(MobilePurchases.LOG_LEVEL.INFO)

      // Set custom log handler to filter out expected errors and noisy messages
      // This prevents "no products configured" errors from causing stack traces
      // and reduces console spam from routine SDK operations
      let hasShownSetupMessage = false
      MobilePurchases.setLogHandler((logLevel: number, message: string) => {
        const lowerMessage = message.toLowerCase()

        // Filter out expected errors that are normal when products aren't configured
        const expectedErrorPatterns = [
          "no products registered",
          "offerings",
          "There are no products",
          "RevenueCat SDK Configuration is not valid",
          "Your app doesn't have any products set up",
          "why-are-offerings-empty",
          "error fetching offerings",
          "operation couldn't be completed",
          "offeringsmanager.error",
          "health report",
          "configuration is not valid",
          "can't make any purchases",
          "purchases instance already set",
          "already configured",
          "font registration",
          "error installing font",
          "fonts.pawwalls.com",
        ]

        const isExpectedError = expectedErrorPatterns.some((pattern) =>
          lowerMessage.includes(pattern.toLowerCase()),
        )

        // Suppress ALL expected errors (they're normal during setup)
        // Show helpful message only once for the first occurrence
        if (isExpectedError) {
          if (!hasShownSetupMessage) {
            hasShownSetupMessage = true
            try {
              logger.info(
                "\n📦 [RevenueCat] Setup Required\n" +
                  "─────────────────────────────────────────────\n" +
                  "To enable subscriptions, configure products in your RevenueCat dashboard:\n" +
                  "1. Go to https://app.revenuecat.com\n" +
                  "2. Navigate to Products → Product Catalog\n" +
                  "3. Create products and add them to an Offering\n" +
                  "4. See: https://rev.cat/how-to-configure-offerings\n" +
                  "\n" +
                  "⚠️  These errors are EXPECTED and NORMAL when API keys are added before products.\n" +
                  "   They will disappear once you create products in the RevenueCat dashboard.\n" +
                  "   You can safely ignore them if you're not using subscriptions yet.\n" +
                  "─────────────────────────────────────────────\n",
              )
            } catch {
              // Silently fail if logging causes issues
            }
          }
          return
        }

        // Filter out noisy INFO/DEBUG messages that clutter the console
        // These are routine SDK operations that don't need to be logged
        const noisyPatterns = [
          "api request started",
          "api request completed",
          "serial request done",
          "requests left in the queue",
          "vending customerinfo",
          "customerinfo cache",
          "customerinfo updated",
          "network operation",
          "skipping request",
          "existing request for products",
          "no existing products cached",
          "started",
          "finished",
          "observing storekit",
          "delegate set",
          "identifying app user",
          "no initial app user",
          "using a simulator",
          "response verification",
          "configured with storekit",
          "sdk version",
          "bundle id",
          "system version",
          "userdefaults suite",
          "debug logging enabled",
        ]

        const isNoisyMessage = noisyPatterns.some((pattern) => lowerMessage.includes(pattern))

        // Skip noisy messages entirely
        if (isNoisyMessage) {
          return
        }

        // Log important messages only
        try {
          if (logLevel === MobilePurchases.LOG_LEVEL.ERROR) {
            logger.error(`[RevenueCat] ${message}`)
          } else if (logLevel === MobilePurchases.LOG_LEVEL.WARN) {
            logger.warn(`[RevenueCat] ${message}`)
          } else if (logLevel === MobilePurchases.LOG_LEVEL.INFO) {
            // Only log truly important INFO messages
            logger.info(`[RevenueCat] ${message}`)
          }
          // Skip DEBUG level entirely to reduce noise
        } catch {
          // Silently fail if logging causes issues
        }
      })

      // Configure SDK with API key
      try {
        await MobilePurchases.configure({ apiKey: mobileApiKey })
        isMobileConfigured = true
      } catch (error) {
        // If already configured (e.g., on hot reload), that's okay
        const errorMessage = error instanceof Error ? error.message : error ? String(error) : ""
        const isAlreadyConfigured =
          errorMessage.includes("already set") ||
          errorMessage.includes("already configured") ||
          errorMessage.includes("Purchases instance already set")

        if (isAlreadyConfigured) {
          isMobileConfigured = true
          if (__DEV__) {
            logger.debug("[RevenueCat] Already configured (hot reload detected)")
          }
        } else {
          throw error
        }
      }
    }
  },

  logIn: async (userId: string) => {
    if (useMock) {
      const result = await mockRevenueCat.logIn(userId)
      return { subscriptionInfo: toSubscriptionInfo(result.customerInfo, "revenuecat") }
    }

    const mobilePurchases = getMobilePurchases()
    const result = await mobilePurchases.logIn(userId)
    return { subscriptionInfo: toSubscriptionInfo(result.customerInfo, "revenuecat") }
  },

  logOut: async () => {
    if (useMock) {
      const result = await mockRevenueCat.logOut()
      return { subscriptionInfo: toSubscriptionInfo(result.customerInfo, "revenuecat") }
    }

    try {
      const mobilePurchases = getMobilePurchases()
      // Check if user is anonymous before attempting logout
      // RevenueCat throws an error if you try to log out an anonymous user
      const isAnonymous = await mobilePurchases.isAnonymous()
      if (isAnonymous) {
        // User is already anonymous, just get current info
        const customerInfo = await mobilePurchases.getCustomerInfo()
        return { subscriptionInfo: toSubscriptionInfo(customerInfo, "revenuecat") }
      }

      // User is authenticated, safe to log out
      const customerInfo = await mobilePurchases.logOut()
      return { subscriptionInfo: toSubscriptionInfo(customerInfo, "revenuecat") }
    } catch (error) {
      // If logout fails (e.g., user is anonymous), just get current info
      if (
        error instanceof Error &&
        (error.message.includes("anonymous") || (error as { code?: string }).code === "22")
      ) {
        try {
          const customerInfo = await getMobilePurchases().getCustomerInfo()
          return { subscriptionInfo: toSubscriptionInfo(customerInfo, "revenuecat") }
        } catch {
          // If getting info also fails, return empty state
          return { subscriptionInfo: toSubscriptionInfo(null, "revenuecat") }
        }
      }
      // Re-throw other errors
      throw error
    }
  },

  getSubscriptionInfo: async () => {
    if (useMock) {
      const info = await mockRevenueCat.getCustomerInfo()
      return toSubscriptionInfo(info, "revenuecat")
    }

    const info = await getMobilePurchases().getCustomerInfo()
    return toSubscriptionInfo(info, "revenuecat")
  },

  getPackages: async () => {
    try {
      if (useMock) {
        return await mockRevenueCat.getPackages()
      }

      const offerings = await getMobilePurchases().getOfferings()
      if (!offerings.current || !offerings.current.availablePackages) return []

      return offerings.current.availablePackages.map((pkg: RevenueCatPackage) => {
        // Extract intro pricing info
        const introPrice = pkg.product.introPrice
        const introPriceData = introPrice
          ? {
              introPrice: introPrice.price,
              introPriceString: introPrice.priceString,
              introPricePeriodUnit: introPrice.periodUnit.toLowerCase() as
                | "day"
                | "week"
                | "month"
                | "year",
              introPricePeriodCount: introPrice.period,
              introPricePeriod: formatPeriod(
                introPrice.period,
                introPrice.periodUnit.toLowerCase() as "day" | "week" | "month" | "year",
              ),
            }
          : {}

        // Extract free trial info
        const freeTrial = pkg.product.freeTrialPeriod
        const freeTrialData = freeTrial
          ? {
              freeTrialPeriodUnit: freeTrial.unit.toLowerCase() as
                | "day"
                | "week"
                | "month"
                | "year",
              freeTrialPeriodCount: freeTrial.value,
              freeTrialPeriod: formatPeriod(
                freeTrial.value,
                freeTrial.unit.toLowerCase() as "day" | "week" | "month" | "year",
              ),
            }
          : {}

        return {
          id: pkg.identifier,
          identifier: pkg.identifier,
          title: pkg.product.title,
          description: pkg.product.description,
          price: pkg.product.price,
          priceString: pkg.product.priceString,
          currencyCode: pkg.product.currencyCode,
          billingPeriod: pkg.packageType === "ANNUAL" ? "annual" : "monthly",
          platform: "revenuecat" as const,
          platformData: pkg,
          ...introPriceData,
          ...freeTrialData,
        }
      })
    } catch (error) {
      // Handle "no products configured" error gracefully
      // This is expected when RevenueCat dashboard isn't set up yet
      if (
        error instanceof Error &&
        (error.message.includes("no products registered") ||
          error.message.includes("offerings") ||
          (error as { code?: string }).code === "23" ||
          (error as { code?: string }).code === "1")
      ) {
        if (__DEV__) {
          logger.info(
            "ℹ️ [RevenueCat] No products configured yet. This is normal if you haven't set up products in the RevenueCat dashboard.",
          )
        }
        return []
      }
      // Log other errors
      logger.error(
        "Error fetching packages",
        {},
        error instanceof Error ? error : new Error(String(error)),
      )
      return []
    }
  },

  purchasePackage: async (pkg: PricingPackage) => {
    try {
      if (useMock) {
        const result = await mockRevenueCat.purchasePackage(pkg.platformData)
        return { subscriptionInfo: toSubscriptionInfo(result.customerInfo, "revenuecat") }
      }

      const result = await getMobilePurchases().purchasePackage(pkg.platformData)
      return {
        subscriptionInfo: toSubscriptionInfo(result.customerInfo ?? null, "revenuecat"),
      }
    } catch (error) {
      return {
        subscriptionInfo: await revenueCatMobile.getSubscriptionInfo(),
        error: error instanceof Error ? error : new Error(String(error)),
      }
    }
  },

  restorePurchases: async () => {
    try {
      if (useMock) {
        const info = await mockRevenueCat.restorePurchases()
        return { subscriptionInfo: toSubscriptionInfo(info, "revenuecat") }
      }

      const info = await getMobilePurchases().restorePurchases()
      return { subscriptionInfo: toSubscriptionInfo(info, "revenuecat") }
    } catch (error) {
      return {
        subscriptionInfo: await revenueCatMobile.getSubscriptionInfo(),
        error: error instanceof Error ? error : new Error(String(error)),
      }
    }
  },

  addSubscriptionUpdateListener: (listener) => {
    if (useMock) {
      return mockRevenueCat.addCustomerInfoUpdateListener((info: RevenueCatCustomerInfo) => {
        listener(toSubscriptionInfo(info, "revenuecat"))
      })
    }

    const nativeListener = (customerInfo: RevenueCatCustomerInfo) => {
      listener(toSubscriptionInfo(customerInfo, "revenuecat"))
    }

    MobilePurchases?.addCustomerInfoUpdateListener(nativeListener)

    return () => {
      MobilePurchases?.removeCustomerInfoUpdateListener(nativeListener)
    }
  },
}

/**
 * RevenueCat Service for Web (Web Billing)
 */
const revenueCatWeb: SubscriptionService = {
  platform: "revenuecat-web",

  configure: async (_config?: Record<string, unknown>) => {
    if (useMock) {
      await mockRevenueCat.configure("mock-api-key")
      return
    }

    // Prevent double configuration
    if (isWebConfigured) {
      if (__DEV__) {
        logger.debug("[RevenueCat Web] Already configured, skipping...")
      }
      return
    }

    // Web SDK is configured per-user in logIn
    // Mark as configured to prevent double initialization
    isWebConfigured = true
    if (__DEV__) {
      logger.info("🌐 [RevenueCat Web] Ready for configuration")
    }
  },

  logIn: async (userId: string) => {
    if (useMock) {
      const result = await mockRevenueCat.logIn(userId)
      return { subscriptionInfo: toSubscriptionInfo(result.customerInfo, "revenuecat-web") }
    }

    if (!webApiKey) {
      logger.warn("RevenueCat Web SDK not available")
      return { subscriptionInfo: toSubscriptionInfo(null, "revenuecat-web") }
    }

    WebPurchases = await loadWebPurchasesSdk()
    if (!WebPurchases) {
      return { subscriptionInfo: toSubscriptionInfo(null, "revenuecat-web") }
    }

    try {
      // Configure Web SDK with user ID
      webPurchasesInstance = WebPurchases.Purchases.configure({
        apiKey: webApiKey,
        appUserId: userId,
      })

      if (__DEV__) {
        logger.info("🌐 [RevenueCat Web] Logged in", { userId })
      }

      const customerInfo = await webPurchasesInstance.getCustomerInfo()
      return { subscriptionInfo: toSubscriptionInfo(customerInfo, "revenuecat-web") }
    } catch (error) {
      logger.error(
        "RevenueCat Web login failed",
        { error },
        error instanceof Error ? error : new Error(String(error)),
      )
      return { subscriptionInfo: toSubscriptionInfo(null, "revenuecat-web") }
    }
  },

  logOut: async () => {
    if (useMock) {
      const result = await mockRevenueCat.logOut()
      return { subscriptionInfo: toSubscriptionInfo(result.customerInfo, "revenuecat-web") }
    }

    webPurchasesInstance = null

    if (__DEV__) {
      logger.info("🌐 [RevenueCat Web] Logged out")
    }

    return { subscriptionInfo: toSubscriptionInfo(null, "revenuecat-web") }
  },

  getSubscriptionInfo: async () => {
    if (useMock) {
      const info = await mockRevenueCat.getCustomerInfo()
      return toSubscriptionInfo(info, "revenuecat-web")
    }

    if (!webPurchasesInstance) {
      return toSubscriptionInfo(null, "revenuecat-web")
    }

    try {
      const customerInfo = await webPurchasesInstance.getCustomerInfo()
      return toSubscriptionInfo(customerInfo, "revenuecat-web")
    } catch (error) {
      logger.error(
        "Failed to get web customer info",
        {},
        error instanceof Error ? error : new Error(String(error)),
      )
      return toSubscriptionInfo(null, "revenuecat-web")
    }
  },

  getPackages: async () => {
    try {
      if (useMock) {
        const packages = await mockRevenueCat.getPackages()
        return packages.map((pkg) => ({ ...pkg, platform: "revenuecat-web" as const }))
      }

      if (!webPurchasesInstance) {
        logger.warn("RevenueCat Web not initialized - call logIn first")
        return []
      }

      const offerings = await webPurchasesInstance.getOfferings()
      if (!offerings.current || !offerings.current.availablePackages) return []

      return offerings.current.availablePackages.map((pkg: RevenueCatWebPackage) => {
        // Extract intro pricing info
        const introPrice = pkg.rcBillingProduct?.introductoryPrice
        const introPriceData = introPrice
          ? {
              introPrice: introPrice.amountMicros ? introPrice.amountMicros / 1_000_000 : null,
              introPriceString: introPrice.formattedPrice || null,
              introPricePeriodUnit: introPrice.periodUnit
                ? (introPrice.periodUnit.toLowerCase() as "day" | "week" | "month" | "year")
                : null,
              introPricePeriodCount: introPrice.periodCount || null,
              introPricePeriod:
                introPrice.periodCount && introPrice.periodUnit
                  ? formatPeriod(
                      introPrice.periodCount,
                      introPrice.periodUnit.toLowerCase() as "day" | "week" | "month" | "year",
                    )
                  : null,
            }
          : {}

        // Extract free trial info
        const freeTrial = pkg.rcBillingProduct?.freeTrialPeriod
        const freeTrialData = freeTrial
          ? {
              freeTrialPeriodUnit: freeTrial.periodUnit
                ? (freeTrial.periodUnit.toLowerCase() as "day" | "week" | "month" | "year")
                : null,
              freeTrialPeriodCount: freeTrial.periodCount || null,
              freeTrialPeriod:
                freeTrial.periodCount && freeTrial.periodUnit
                  ? formatPeriod(
                      freeTrial.periodCount,
                      freeTrial.periodUnit.toLowerCase() as "day" | "week" | "month" | "year",
                    )
                  : null,
            }
          : {}

        return {
          id: pkg.identifier,
          identifier: pkg.identifier,
          title: pkg.rcBillingProduct?.displayName || pkg.identifier,
          description: pkg.rcBillingProduct?.description || "",
          price: pkg.rcBillingProduct?.currentPrice?.amountMicros
            ? pkg.rcBillingProduct.currentPrice.amountMicros / 1_000_000
            : 0,
          priceString: pkg.rcBillingProduct?.currentPrice?.formattedPrice || "",
          currencyCode: pkg.rcBillingProduct?.currentPrice?.currency || "USD",
          billingPeriod: pkg.packageType === "ANNUAL" ? "annual" : "monthly",
          platform: "revenuecat-web" as const,
          platformData: pkg,
          ...introPriceData,
          ...freeTrialData,
        }
      })
    } catch (error) {
      // Handle "no products configured" error gracefully
      // This is expected when RevenueCat dashboard isn't set up yet
      if (
        error instanceof Error &&
        (error.message.includes("no products registered") ||
          error.message.includes("offerings") ||
          (error as { code?: string }).code === "23" ||
          (error as { code?: string }).code === "1")
      ) {
        if (__DEV__) {
          logger.info(
            "ℹ️ [RevenueCat Web] No products configured yet. This is normal if you haven't set up products in the RevenueCat dashboard.",
          )
        }
        return []
      }
      // Log other errors
      logger.error(
        "Error fetching web packages",
        {},
        error instanceof Error ? error : new Error(String(error)),
      )
      return []
    }
  },

  purchasePackage: async (pkg: PricingPackage) => {
    try {
      if (useMock) {
        const result = await mockRevenueCat.purchasePackage(pkg.platformData)
        return { subscriptionInfo: toSubscriptionInfo(result.customerInfo, "revenuecat-web") }
      }

      if (!webPurchasesInstance) {
        throw new Error("RevenueCat Web not initialized")
      }

      // Web SDK purchase - this opens a checkout modal/redirect
      const { customerInfo } = await webPurchasesInstance.purchase({ rcPackage: pkg.platformData })

      if (__DEV__) {
        logger.info("🌐 [RevenueCat Web] Purchase successful")
      }

      return { subscriptionInfo: toSubscriptionInfo(customerInfo, "revenuecat-web") }
    } catch (error) {
      logger.error(
        "Web purchase failed",
        {},
        error instanceof Error ? error : new Error(String(error)),
      )
      return {
        subscriptionInfo: await revenueCatWeb.getSubscriptionInfo(),
        error: error instanceof Error ? error : new Error(String(error)),
      }
    }
  },

  restorePurchases: async () => {
    // Web doesn't have "restore" in the same sense - we just refetch customer info
    const subscriptionInfo = await revenueCatWeb.getSubscriptionInfo()
    return { subscriptionInfo }
  },

  getManagementUrl: async () => {
    if (useMock) {
      return "https://mock-revenuecat.com/manage"
    }

    if (!webPurchasesInstance) {
      return null
    }

    try {
      const customerInfo = await webPurchasesInstance.getCustomerInfo()
      return customerInfo.managementURL || null
    } catch {
      return null
    }
  },
}

/**
 * Get the appropriate RevenueCat service based on platform
 */
export function getRevenueCatService(): SubscriptionService {
  if (Platform.OS === "web") {
    return revenueCatWeb
  }
  return revenueCatMobile
}

/**
 * Export the appropriate service based on platform
 */
export const revenueCat: SubscriptionService = getRevenueCatService()

/**
 * Initialize RevenueCat (call on app startup)
 */
export const initRevenueCat = async () => {
  await revenueCat.configure({})

  if (__DEV__) {
    if (useMock) {
      logger.warn("⚠️  RevenueCat running in mock mode")
      logger.info("💡 Add EXPO_PUBLIC_REVENUECAT_*_KEY to .env")
    } else {
      logger.info("💰 RevenueCat initialized", { platform: Platform.OS })
    }
  }
}

// Export both services for direct access if needed
export { revenueCatMobile, revenueCatWeb }

// Expose mock status for UI hints
export const isRevenueCatMock = useMock
