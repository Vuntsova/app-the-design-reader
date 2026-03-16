import { useEffect } from "react"

import { useNotificationStore } from "@/stores/notificationStore"
import { deepLinking } from "@/utils/deepLinking"

/**
 * Hook to handle deep linking and notifications
 * Call this once in your root app component
 */
export function useDeepLinking() {
  useEffect(() => {
    // Initialize deep linking
    const subscription = deepLinking.initialize()

    // Initialize notification handling
    const notificationStore = useNotificationStore.getState()
    notificationStore.initialize()

    // Cleanup
    return () => {
      subscription.then((sub) => sub?.remove()).catch(() => {})
    }
  }, [])
}
