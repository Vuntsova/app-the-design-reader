import { createContext, useContext, useEffect, useState } from "react"

import { useAuth } from "./AuthContext"
import { revenueCat } from "../services/revenuecat"
import type { SubscriptionInfo } from "../types/subscription"
import { logger } from "../utils/Logger"

type SubscriptionContextType = {
  isPro: boolean
  subscriptionInfo: SubscriptionInfo | null
  restorePermissions: () => Promise<SubscriptionInfo | null>
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  isPro: false,
  subscriptionInfo: null,
  restorePermissions: async () => null,
})

export const SubscriptionProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth()
  const [isPro, setIsPro] = useState(false)
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null)

  useEffect(() => {
    let mounted = true

    const handleAuth = async () => {
      if (user) {
        const { subscriptionInfo: info } = await revenueCat.logIn(user.id)
        if (mounted) {
          setSubscriptionInfo(info)
          setIsPro(info.isActive)
        }
      } else {
        // When no user, get subscription info instead of calling logOut
        // logOut() fails if user is already anonymous
        try {
          const info = await revenueCat.getSubscriptionInfo()
          if (mounted) {
            setSubscriptionInfo(info)
            setIsPro(false)
          }
        } catch {
          // If getting info fails, just set empty state
          if (mounted) {
            setSubscriptionInfo(null)
            setIsPro(false)
          }
        }
      }
    }

    handleAuth()

    return () => {
      mounted = false
    }
  }, [user])

  useEffect(() => {
    // Set up subscription update listener
    const unsubscribe = revenueCat.addSubscriptionUpdateListener?.((info) => {
      setSubscriptionInfo(info)
      setIsPro(info.isActive)
    })

    return () => {
      unsubscribe?.()
    }
  }, [])

  const restorePermissions = async (): Promise<SubscriptionInfo | null> => {
    try {
      const { subscriptionInfo: info, error } = await revenueCat.restorePurchases()

      if (error) {
        logger.error("Restore failed", { error })
        return null
      }

      setSubscriptionInfo(info)
      setIsPro(info.isActive)
      return info
    } catch (e) {
      logger.error("Restore failed", { error: e })
      return null
    }
  }

  return (
    <SubscriptionContext.Provider value={{ isPro, subscriptionInfo, restorePermissions }}>
      {children}
    </SubscriptionContext.Provider>
  )
}

export const useSubscription = () => useContext(SubscriptionContext)
