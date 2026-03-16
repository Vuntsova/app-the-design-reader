import { useState, useEffect, useCallback, useRef, useMemo } from "react"

import { getBackend, isUsingMockBackend } from "../services/backend"
import type { PresenceChannel } from "../services/backend/types"
import type { PresenceState } from "../types/realtime"
import { logger } from "../utils/Logger"

export interface UseRealtimePresenceOptions {
  /** Unique channel name (e.g., 'room:123', 'document:abc') */
  channelName: string
  /** User's initial status */
  initialStatus?: PresenceState["status"]
  /** Custom data to broadcast with presence */
  customData?: Record<string, unknown>
  /** Called when presence state changes */
  onPresenceChange?: (users: PresenceState[]) => void
  /** Called when a user joins */
  onUserJoin?: (user: PresenceState) => void
  /** Called when a user leaves */
  onUserLeave?: (userId: string) => void
}

export interface UseRealtimePresenceReturn {
  /** List of users currently present */
  presentUsers: PresenceState[]
  /** Number of users present */
  userCount: number
  /** Whether the presence channel is connected */
  isConnected: boolean
  /** Error state */
  error: Error | null
  /** Update your own status */
  updateStatus: (status: PresenceState["status"]) => void
  /** Update custom data */
  updateCustomData: (data: Record<string, unknown>) => void
  /** Check if a specific user is online */
  isUserOnline: (userId: string) => boolean
  /** Get a specific user's presence */
  getUserPresence: (userId: string) => PresenceState | undefined
}

/**
 * Hook for real-time presence tracking (online users, activity status)
 *
 * Uses the backend abstraction layer for provider-agnostic presence functionality.
 *
 * @example
 * ```tsx
 * function OnlineUsers({ roomId }: { roomId: string }) {
 *   const {
 *     presentUsers,
 *     userCount,
 *     isConnected,
 *     updateStatus,
 *   } = useRealtimePresence({
 *     channelName: `room:${roomId}`,
 *     initialStatus: 'online',
 *     onUserJoin: (user) => console.log(`${user.user_id} joined`),
 *     onUserLeave: (userId) => console.log(`${userId} left`),
 *   })
 *
 *   return (
 *     <View>
 *       <Text>{userCount} users online</Text>
 *       {presentUsers.map((user) => (
 *         <UserAvatar
 *           key={user.user_id}
 *           userId={user.user_id}
 *           status={user.status}
 *         />
 *       ))}
 *       <Picker
 *         selectedValue={status}
 *         onValueChange={(v) => updateStatus(v)}
 *       >
 *         <Picker.Item label="Online" value="online" />
 *         <Picker.Item label="Away" value="away" />
 *         <Picker.Item label="Busy" value="busy" />
 *       </Picker>
 *     </View>
 *   )
 * }
 * ```
 */
export function useRealtimePresence(
  options: UseRealtimePresenceOptions,
): UseRealtimePresenceReturn {
  const {
    channelName,
    initialStatus = "online",
    customData,
    onPresenceChange,
    onUserJoin,
    onUserLeave,
  } = options

  // Serialize customData to stabilize the dependency array and avoid re-subscribing every render
  const customDataSerialized = useMemo(() => JSON.stringify(customData ?? {}), [customData])
  const stableCustomData = useMemo(
    () => (customData ?? {}) as Record<string, unknown>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customDataSerialized],
  )

  const [presentUsers, setPresentUsers] = useState<PresenceState[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const channelRef = useRef<PresenceChannel | null>(null)
  const currentUserIdRef = useRef<string | null>(null)
  const currentStatusRef = useRef<PresenceState["status"]>(initialStatus)
  const currentCustomDataRef = useRef<Record<string, unknown>>(stableCustomData)

  // Track presence and sync state
  const syncPresence = useCallback(
    (state: Record<string, unknown[]>) => {
      const users: PresenceState[] = []

      // Flatten presence state (each user can have multiple connections)
      Object.values(state).forEach((presences) => {
        // Take the most recent presence for each user
        if (presences.length > 0) {
          users.push(presences[0] as PresenceState)
        }
      })

      setPresentUsers(users)
      onPresenceChange?.(users)
    },
    [onPresenceChange],
  )

  // Set up presence channel
  useEffect(() => {
    if (isUsingMockBackend()) {
      setIsConnected(true)
      // Mock: show current user as present
      const mockPresence: PresenceState = {
        user_id: "mock-user",
        online_at: new Date().toISOString(),
        status: initialStatus,
        custom: stableCustomData,
      }
      setPresentUsers([mockPresence])
      return
    }

    let isMounted = true
    const backend = getBackend()

    const setupPresence = async () => {
      try {
        // Get current user
        const { data } = await backend.auth.getUser()
        if (!data?.user || !isMounted) return

        currentUserIdRef.current = data.user.id

        const channel = backend.realtime.createPresenceChannel(channelName)

        channel
          .onSync(() => {
            const state = channel.presenceState()
            syncPresence(state)
          })
          .onJoin((_key, _currentPresences, newPresences) => {
            newPresences.forEach((presence) => {
              const presenceData = presence as PresenceState
              onUserJoin?.(presenceData)
              logger.debug("[useRealtimePresence] User joined", {
                userId: presenceData.user_id,
                channel: channelName,
              })
            })
          })
          .onLeave((_key, _currentPresences, leftPresences) => {
            leftPresences.forEach((presence) => {
              const presenceData = presence as PresenceState
              onUserLeave?.(presenceData.user_id)
              logger.debug("[useRealtimePresence] User left", {
                userId: presenceData.user_id,
                channel: channelName,
              })
            })
          })
          .subscribe(async (status, err) => {
            if (!isMounted) return

            if (status === "SUBSCRIBED") {
              // Track our presence
              const presenceState: PresenceState = {
                user_id: data.user.id,
                online_at: new Date().toISOString(),
                status: currentStatusRef.current,
                custom: currentCustomDataRef.current,
              }

              await channel.track(presenceState as unknown as Record<string, unknown>)
              setIsConnected(true)
              logger.debug("[useRealtimePresence] Connected to presence channel", { channelName })
            } else if (status === "ERROR") {
              setIsConnected(false)
              setError(err ?? new Error("Failed to connect to presence channel"))
              logger.error("[useRealtimePresence] Channel error", { channelName })
            }
          })

        channelRef.current = channel
      } catch (err) {
        if (!isMounted) return
        const resolvedError = err instanceof Error ? err : new Error(String(err))
        logger.error("[useRealtimePresence] Setup failed", { channelName }, resolvedError)
        setError(resolvedError)
      }
    }

    setupPresence()

    return () => {
      isMounted = false
      if (channelRef.current) {
        channelRef.current.unsubscribe()
        channelRef.current = null
      }
      setIsConnected(false)
    }
  }, [channelName, initialStatus, stableCustomData, syncPresence, onUserJoin, onUserLeave])

  // Update status
  const updateStatus = useCallback(async (status: PresenceState["status"]) => {
    currentStatusRef.current = status

    if (isUsingMockBackend()) {
      setPresentUsers((prev) => prev.map((u) => (u.user_id === "mock-user" ? { ...u, status } : u)))
      return
    }

    if (!channelRef.current || !currentUserIdRef.current) return

    try {
      const presenceState: PresenceState = {
        user_id: currentUserIdRef.current,
        online_at: new Date().toISOString(),
        status,
        custom: currentCustomDataRef.current,
      }

      await channelRef.current.track(presenceState as unknown as Record<string, unknown>)
    } catch (err) {
      logger.error("[useRealtimePresence] Failed to update status", {}, err as Error)
    }
  }, [])

  // Update custom data
  const updateCustomData = useCallback(async (data: Record<string, unknown>) => {
    currentCustomDataRef.current = { ...currentCustomDataRef.current, ...data }

    if (isUsingMockBackend()) {
      setPresentUsers((prev) =>
        prev.map((u) =>
          u.user_id === "mock-user" ? { ...u, custom: currentCustomDataRef.current } : u,
        ),
      )
      return
    }

    if (!channelRef.current || !currentUserIdRef.current) return

    try {
      const presenceState: PresenceState = {
        user_id: currentUserIdRef.current,
        online_at: new Date().toISOString(),
        status: currentStatusRef.current,
        custom: currentCustomDataRef.current,
      }

      await channelRef.current.track(presenceState as unknown as Record<string, unknown>)
    } catch (err) {
      logger.error("[useRealtimePresence] Failed to update custom data", {}, err as Error)
    }
  }, [])

  // Check if user is online
  const isUserOnline = useCallback(
    (userId: string) => {
      return presentUsers.some((u) => u.user_id === userId && u.status !== "offline")
    },
    [presentUsers],
  )

  // Get user presence
  const getUserPresence = useCallback(
    (userId: string) => {
      return presentUsers.find((u) => u.user_id === userId)
    },
    [presentUsers],
  )

  return {
    presentUsers,
    userCount: presentUsers.length,
    isConnected,
    error,
    updateStatus,
    updateCustomData,
    isUserOnline,
    getUserPresence,
  }
}
