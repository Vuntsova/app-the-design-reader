/**
 * Subscription trust boundary
 * ---------------------------
 * RevenueCat is the source of truth for entitlement. The persisted `isPro`
 * flag (and full `customerInfo` / `webSubscriptionInfo`) is a UX cache only —
 * it lets gated screens render instantly on cold start without waiting for
 * RevenueCat to round-trip.
 *
 * Anything that actually unlocks paid functionality on the SERVER (Convex
 * mutations, Supabase RPCs, Edge Functions) MUST verify entitlement against
 * RevenueCat (or a webhook-synced server table), not against this store.
 * Treat any client-supplied `isPro=true` as untrusted: an attacker can edit
 * MMKV on a jailbroken device and flip it.
 *
 * If you add subscriber-only fields to a query/mutation, gate them server-side.
 * See vibe/MONETIZATION.md → "Trust Boundary" for the canonical reference.
 */

import { Platform } from "react-native"
import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

import { useAuthStore } from "./auth"
import { revenueCat } from "../services/revenuecat"
import type {
  SubscriptionPlatform,
  SubscriptionInfo,
  PricingPackage,
  SubscriptionService,
  SubscriptionLifecycleData,
} from "../types/subscription"
import { logger } from "../utils/Logger"
import * as storage from "../utils/storage"
import { detectLifecycleEvent, getLifecycleEventDescription } from "../utils/subscriptionHelpers"
// NOTE: This is a circular import — auth/* imports useSubscriptionStore from
// here. It works because we only ever read useAuthStore inside function bodies
// (initialize, subscribeToAuthChanges), never at module-evaluation time.
import type { AuthState } from "./auth/authTypes"

interface SubscriptionState {
  isPro: boolean
  platform: SubscriptionPlatform

  // RevenueCat data (mobile)
  customerInfo: SubscriptionInfo | null

  // RevenueCat Web data
  webSubscriptionInfo: SubscriptionInfo | null

  // Unified packages
  packages: PricingPackage[]
  loading: boolean

  // Lifecycle tracking
  lifecycleListeners: Array<(event: SubscriptionLifecycleData) => void>

  // Actions
  setCustomerInfo: (info: SubscriptionInfo | null) => void
  setWebSubscriptionInfo: (info: SubscriptionInfo | null) => void
  setPackages: (packages: PricingPackage[]) => void
  checkProStatus: () => void
  fetchPackages: () => Promise<void>
  purchasePackage: (pkg: PricingPackage) => Promise<{ error?: Error }>
  restorePurchases: () => Promise<{ error?: Error }>
  initialize: () => Promise<void>
  cleanup: () => void
  getActiveService: () => SubscriptionService
  addLifecycleListener: (listener: (event: SubscriptionLifecycleData) => void) => () => void
}

// Custom storage adapter for Zustand to use MMKV
const mmkvStorage = {
  getItem: async (name: string) => {
    const value = storage.load(name)
    return value ? JSON.stringify(value) : null
  },
  setItem: async (name: string, value: string) => {
    storage.save(name, JSON.parse(value))
  },
  removeItem: async (name: string) => {
    storage.remove(name)
  },
}

let subscriptionUpdateUnsubscribe: (() => void) | null = null
let initializeInFlight: Promise<void> | null = null

const clearSubscriptionUpdateListener = () => {
  if (subscriptionUpdateUnsubscribe) {
    subscriptionUpdateUnsubscribe()
    subscriptionUpdateUnsubscribe = null
  }
}

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set, get) => ({
      isPro: false,
      platform: Platform.OS === "web" ? "revenuecat-web" : "revenuecat",
      customerInfo: null,
      webSubscriptionInfo: null,
      packages: [],
      loading: false,
      lifecycleListeners: [],

      getActiveService: (): SubscriptionService => {
        // RevenueCat handles both mobile and web now
        return revenueCat
      },

      setCustomerInfo: (info) => {
        const { customerInfo: oldInfo, lifecycleListeners } = get()

        // Detect lifecycle events (only if new info is not null)
        const lifecycleEvent = info ? detectLifecycleEvent(oldInfo, info) : null
        if (lifecycleEvent) {
          // Log event
          if (__DEV__) {
            logger.info(
              `🔄 Subscription Event: ${getLifecycleEventDescription(lifecycleEvent.event)}`,
              {
                event: lifecycleEvent,
              },
            )
          }

          // Notify listeners
          lifecycleListeners.forEach((listener) => {
            try {
              listener(lifecycleEvent)
            } catch (error) {
              logger.error("Lifecycle listener error", { error })
            }
          })
        }

        set({ customerInfo: info })
        get().checkProStatus()
      },

      setWebSubscriptionInfo: (info) => {
        const { webSubscriptionInfo: oldInfo, lifecycleListeners } = get()

        // Detect lifecycle events (only if new info is not null)
        const lifecycleEvent = info ? detectLifecycleEvent(oldInfo, info) : null
        if (lifecycleEvent) {
          // Log event
          if (__DEV__) {
            logger.info(
              `🔄 Subscription Event: ${getLifecycleEventDescription(lifecycleEvent.event)}`,
              {
                event: lifecycleEvent,
              },
            )
          }

          // Notify listeners
          lifecycleListeners.forEach((listener) => {
            try {
              listener(lifecycleEvent)
            } catch (error) {
              logger.error("Lifecycle listener error", { error })
            }
          })
        }

        set({ webSubscriptionInfo: info })
        get().checkProStatus()
      },

      setPackages: (packages) => {
        set({ packages })
      },

      checkProStatus: () => {
        const { customerInfo, webSubscriptionInfo, platform } = get()

        let isPro = false

        if (platform === "revenuecat") {
          isPro = customerInfo?.isActive ?? false
        }

        if (platform === "revenuecat-web") {
          isPro = webSubscriptionInfo?.isActive ?? false
        }

        set({ isPro })
      },

      fetchPackages: async () => {
        try {
          const service = get().getActiveService()
          const packages = await service.getPackages()
          set({ packages })
        } catch (error) {
          // getPackages already handles "no products" errors gracefully
          // Only log unexpected errors here
          if (
            !(error instanceof Error) ||
            (!error.message.includes("no products registered") &&
              !error.message.includes("offerings") &&
              (error as { code?: string }).code !== "23" &&
              (error as { code?: string }).code !== "1")
          ) {
            logger.error("Failed to fetch packages", { error })
          }
        }
      },

      purchasePackage: async (pkg) => {
        try {
          set({ loading: true })
          const service = get().getActiveService()
          const { platform } = get()

          const result = await service.purchasePackage(pkg)

          if (platform === "revenuecat-web") {
            set({
              webSubscriptionInfo: result.subscriptionInfo,
              loading: false,
            })
          } else {
            set({
              customerInfo: result.subscriptionInfo,
              loading: false,
            })
          }

          get().checkProStatus()

          return result.error ? { error: result.error } : {}
        } catch (error) {
          set({ loading: false })

          // User cancelled
          if (error && typeof error === "object" && "userCancelled" in error) {
            return {}
          }

          return { error: error instanceof Error ? error : new Error(String(error)) }
        }
      },

      restorePurchases: async () => {
        try {
          set({ loading: true })
          const service = get().getActiveService()
          const { platform } = get()

          const result = await service.restorePurchases()

          if (platform === "revenuecat-web") {
            set({
              webSubscriptionInfo: result.subscriptionInfo,
              loading: false,
            })
          } else {
            set({
              customerInfo: result.subscriptionInfo,
              loading: false,
            })
          }

          get().checkProStatus()

          return result.error ? { error: result.error } : {}
        } catch (error) {
          set({ loading: false })
          return { error: error as Error }
        }
      },

      initialize: async () => {
        if (initializeInFlight) {
          await initializeInFlight
          return
        }

        initializeInFlight = (async () => {
          try {
            const user = useAuthStore.getState().user
            const service = get().getActiveService()
            const { platform } = get()

            if (user) {
              // Login to RevenueCat with user ID
              const result = await service.logIn(user.id)

              if (platform === "revenuecat-web") {
                set({ webSubscriptionInfo: result.subscriptionInfo })
              } else {
                set({ customerInfo: result.subscriptionInfo })
              }

              get().checkProStatus()
            } else {
              // When no user, just get subscription info for anonymous user
              // Don't call logOut() as it fails if user is already anonymous
              try {
                const subscriptionInfo = await service.getSubscriptionInfo()

                if (platform === "revenuecat-web") {
                  set({
                    webSubscriptionInfo: subscriptionInfo,
                    isPro: false,
                  })
                } else {
                  set({
                    customerInfo: subscriptionInfo,
                    isPro: false,
                  })
                }
              } catch {
                // If getting info fails, just set empty state
                // This can happen if RevenueCat isn't fully initialized yet
                if (platform === "revenuecat-web") {
                  set({
                    webSubscriptionInfo: null,
                    isPro: false,
                  })
                } else {
                  set({
                    customerInfo: null,
                    isPro: false,
                  })
                }
              }
            }

            // Fetch available packages
            await get().fetchPackages()

            // Prevent duplicate listeners when initialize() is called repeatedly.
            clearSubscriptionUpdateListener()

            // Listen for subscription updates (if supported)
            if (service.addSubscriptionUpdateListener) {
              const unsubscribe = service.addSubscriptionUpdateListener((info) => {
                const { platform: currentPlatform } = get()
                if (currentPlatform === "revenuecat-web") {
                  set({ webSubscriptionInfo: info })
                } else {
                  set({ customerInfo: info })
                }
                get().checkProStatus()
              })

              subscriptionUpdateUnsubscribe = typeof unsubscribe === "function" ? unsubscribe : null
            }
          } catch (error) {
            logger.error("Subscription initialization failed", { error })
          } finally {
            initializeInFlight = null
          }
        })()

        await initializeInFlight
      },

      cleanup: () => {
        clearSubscriptionUpdateListener()
      },

      addLifecycleListener: (listener) => {
        set((state) => ({
          lifecycleListeners: [...state.lifecycleListeners, listener],
        }))

        // Return unsubscribe function
        return () => {
          set((state) => ({
            lifecycleListeners: state.lifecycleListeners.filter((l) => l !== listener),
          }))
        }
      },
    }),
    {
      name: "subscription-storage",
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        // Only persist isPro and subscription info
        isPro: state.isPro,
        platform: state.platform,
        customerInfo: state.customerInfo,
        webSubscriptionInfo: state.webSubscriptionInfo,
      }),
    },
  ),
)

// Listen for auth changes to re-initialize subscription status
const subscribeToAuthChanges = () => {
  useAuthStore.subscribe((state: AuthState, prevState: AuthState) => {
    if (state.user?.id !== prevState.user?.id) {
      useSubscriptionStore
        .getState()
        .initialize()
        .catch((err) => {
          logger.error("Failed to re-initialize subscription on auth change", { error: err })
        })
    }
  })
}

if (process.env.NODE_ENV !== "test" && typeof setTimeout === "function") {
  setTimeout(() => {
    try {
      subscribeToAuthChanges()
    } catch (error) {
      if (__DEV__) {
        logger.warn("Failed to subscribe to auth changes for subscription store", { error })
      }
    }
  }, 0)
}
