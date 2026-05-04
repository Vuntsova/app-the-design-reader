/**
 * Notification Flow Integration Tests
 *
 * Tests for complete notification flows including:
 * - Permission requests
 * - Push token registration
 * - Token sync to backend
 * - Notification handling
 */

import { SchedulableTriggerInputTypes } from "expo-notifications"
import { act, renderHook, waitFor } from "@testing-library/react-native"

import * as notificationService from "../../services/notifications"
import * as preferencesSync from "../../services/preferencesSync"
import { useNotificationStore } from "../../stores/notificationStore"

// Mock notification service
jest.mock("../../services/notifications", () => ({
  requestPermission: jest.fn(),
  registerForPushNotifications: jest.fn(),
  scheduleNotification: jest.fn(),
  cancelNotification: jest.fn(),
  cancelAllNotifications: jest.fn(),
  setBadgeCount: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addPushTokenListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponse: jest.fn(),
  showPermissionDeniedAlert: jest.fn(),
}))

// Mock preferences sync
jest.mock("../../services/preferencesSync", () => ({
  syncPushNotificationsPreference: jest.fn(),
  syncPushToken: jest.fn(),
}))

// Mock auth store
jest.mock("@/stores/auth", () => ({
  useAuthStore: {
    getState: jest.fn(() => ({
      user: { id: "test-user-123" },
    })),
  },
}))

describe("Notification Flow Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset notification store
    useNotificationStore.setState({
      permissionStatus: "undetermined",
      pushToken: null,
      notifications: [],
      unreadCount: 0,
      badgeCount: 0,
      isPushEnabled: false,
    })
  })

  describe("Permission Request Flow", () => {
    it("should request permission and register for push notifications when granted", async () => {
      const { result } = renderHook(() => useNotificationStore())

      // Mock permission granted
      ;(notificationService.requestPermission as jest.Mock).mockResolvedValue({
        status: "granted",
      })
      ;(notificationService.registerForPushNotifications as jest.Mock).mockResolvedValue(
        "ExponentPushToken[test-token-123]",
      )

      await act(async () => {
        const granted = await result.current.requestPermission()
        expect(granted).toBe(true)
      })

      await waitFor(() => {
        expect(result.current.permissionStatus).toBe("granted")
        expect(result.current.pushToken).toBe("ExponentPushToken[test-token-123]")
      })

      // Verify token sync was called
      expect(preferencesSync.syncPushToken).toHaveBeenCalledWith(
        "test-user-123",
        "ExponentPushToken[test-token-123]",
      )
    })

    it("should handle permission denied", async () => {
      const { result } = renderHook(() => useNotificationStore())

      // Mock permission denied
      ;(notificationService.requestPermission as jest.Mock).mockResolvedValue({
        status: "denied",
      })

      await act(async () => {
        const granted = await result.current.requestPermission()
        expect(granted).toBe(false)
      })

      await waitFor(() => {
        expect(result.current.permissionStatus).toBe("denied")
        expect(result.current.pushToken).toBeNull()
      })

      // Verify alert was shown
      expect(notificationService.showPermissionDeniedAlert).toHaveBeenCalled()
    })
  })

  describe("Push Token Registration", () => {
    it("should register push token and sync to backend", async () => {
      const { result } = renderHook(() => useNotificationStore())

      ;(notificationService.registerForPushNotifications as jest.Mock).mockResolvedValue(
        "ExponentPushToken[new-token-456]",
      )

      await act(async () => {
        await result.current.registerForPush()
      })

      await waitFor(() => {
        expect(result.current.pushToken).toBe("ExponentPushToken[new-token-456]")
      })

      // Verify sync was called
      expect(preferencesSync.syncPushToken).toHaveBeenCalledWith(
        "test-user-123",
        "ExponentPushToken[new-token-456]",
      )
    })

    it("should not sync if token is null", async () => {
      const { result } = renderHook(() => useNotificationStore())

      ;(notificationService.registerForPushNotifications as jest.Mock).mockResolvedValue(null)

      await act(async () => {
        await result.current.registerForPush()
      })

      expect(preferencesSync.syncPushToken).not.toHaveBeenCalled()
    })
  })

  describe("Toggle Push Notifications", () => {
    it("should enable push notifications and sync preference", async () => {
      const { result } = renderHook(() => useNotificationStore())

      ;(notificationService.requestPermission as jest.Mock).mockResolvedValue({
        status: "granted",
      })
      ;(notificationService.registerForPushNotifications as jest.Mock).mockResolvedValue(
        "ExponentPushToken[test-token]",
      )

      await act(async () => {
        await result.current.togglePush()
      })

      await waitFor(() => {
        expect(result.current.isPushEnabled).toBe(true)
      })

      expect(preferencesSync.syncPushNotificationsPreference).toHaveBeenCalledWith(
        "test-user-123",
        true,
      )
    })

    it("should disable push notifications and sync preference", async () => {
      // Start with push enabled
      useNotificationStore.setState({ isPushEnabled: true })
      const { result } = renderHook(() => useNotificationStore())

      await act(async () => {
        await result.current.togglePush()
      })

      await waitFor(() => {
        expect(result.current.isPushEnabled).toBe(false)
      })

      expect(preferencesSync.syncPushNotificationsPreference).toHaveBeenCalledWith(
        "test-user-123",
        false,
      )
    })
  })

  describe("Notification Management", () => {
    it("should add notification and update unread count", async () => {
      const { result } = renderHook(() => useNotificationStore())

      ;(notificationService.setBadgeCount as jest.Mock).mockResolvedValue(undefined)

      await act(async () => {
        result.current.addNotification({
          id: "notif-1",
          title: "Test Notification",
          body: "This is a test",
          data: { screen: "Home" },
        })
      })

      await waitFor(() => {
        expect(result.current.notifications).toHaveLength(1)
        expect(result.current.unreadCount).toBe(1)
        expect(result.current.notifications[0].title).toBe("Test Notification")
        expect(result.current.notifications[0].read).toBe(false)
      })
    })

    it("should mark notification as read", async () => {
      // Add a notification first
      useNotificationStore.setState({
        notifications: [
          {
            id: "notif-1",
            title: "Test",
            body: "Test body",
            receivedAt: new Date().toISOString(),
            read: false,
          },
        ],
        unreadCount: 1,
      })

      const { result } = renderHook(() => useNotificationStore())

      ;(notificationService.setBadgeCount as jest.Mock).mockResolvedValue(undefined)

      await act(async () => {
        result.current.markAsRead("notif-1")
      })

      await waitFor(() => {
        expect(result.current.notifications[0].read).toBe(true)
        expect(result.current.unreadCount).toBe(0)
      })
    })

    it("should mark all notifications as read", async () => {
      useNotificationStore.setState({
        notifications: [
          {
            id: "notif-1",
            title: "Test 1",
            body: "Body 1",
            receivedAt: new Date().toISOString(),
            read: false,
          },
          {
            id: "notif-2",
            title: "Test 2",
            body: "Body 2",
            receivedAt: new Date().toISOString(),
            read: false,
          },
        ],
        unreadCount: 2,
      })

      const { result } = renderHook(() => useNotificationStore())

      ;(notificationService.setBadgeCount as jest.Mock).mockResolvedValue(undefined)

      await act(async () => {
        result.current.markAllAsRead()
      })

      await waitFor(() => {
        expect(result.current.notifications.every((n) => n.read)).toBe(true)
        expect(result.current.unreadCount).toBe(0)
      })
    })

    it("should limit notifications to last 50", async () => {
      const { result } = renderHook(() => useNotificationStore())

      ;(notificationService.setBadgeCount as jest.Mock).mockResolvedValue(undefined)

      // Add 55 notifications
      await act(async () => {
        for (let i = 0; i < 55; i++) {
          result.current.addNotification({
            id: `notif-${i}`,
            title: `Notification ${i}`,
            body: `Body ${i}`,
          })
        }
      })

      await waitFor(() => {
        expect(result.current.notifications.length).toBe(50)
        // Most recent should be first
        expect(result.current.notifications[0].id).toBe("notif-54")
      })
    })
  })

  describe("Badge Count", () => {
    it("should set badge count", async () => {
      const { result } = renderHook(() => useNotificationStore())

      ;(notificationService.setBadgeCount as jest.Mock).mockResolvedValue(undefined)

      await act(async () => {
        await result.current.setBadgeCount(5)
      })

      await waitFor(() => {
        expect(result.current.badgeCount).toBe(5)
      })

      expect(notificationService.setBadgeCount).toHaveBeenCalledWith(5)
    })

    it("should clear badge", async () => {
      useNotificationStore.setState({ badgeCount: 10 })
      const { result } = renderHook(() => useNotificationStore())

      ;(notificationService.setBadgeCount as jest.Mock).mockResolvedValue(undefined)

      await act(async () => {
        await result.current.clearBadge()
      })

      await waitFor(() => {
        expect(result.current.badgeCount).toBe(0)
      })
    })
  })

  describe("Local Notifications", () => {
    it("should schedule a local notification", async () => {
      const { result } = renderHook(() => useNotificationStore())

      ;(notificationService.scheduleNotification as jest.Mock).mockResolvedValue("scheduled-id-123")

      let scheduledId: string | undefined
      await act(async () => {
        scheduledId = await result.current.scheduleNotification({
          title: "Reminder",
          body: "Don't forget!",
          trigger: {
            type: SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: 60,
            repeats: false,
          },
        })
      })

      expect(scheduledId).toBe("scheduled-id-123")
      expect(notificationService.scheduleNotification).toHaveBeenCalledWith({
        title: "Reminder",
        body: "Don't forget!",
        trigger: {
          type: SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 60,
          repeats: false,
        },
      })
    })

    it("should cancel a notification", async () => {
      const { result } = renderHook(() => useNotificationStore())

      ;(notificationService.cancelNotification as jest.Mock).mockResolvedValue(undefined)

      await act(async () => {
        await result.current.cancelNotification("notif-to-cancel")
      })

      expect(notificationService.cancelNotification).toHaveBeenCalledWith("notif-to-cancel")
    })

    it("should cancel all notifications", async () => {
      const { result } = renderHook(() => useNotificationStore())

      ;(notificationService.cancelAllNotifications as jest.Mock).mockResolvedValue(undefined)

      await act(async () => {
        await result.current.cancelAllNotifications()
      })

      expect(notificationService.cancelAllNotifications).toHaveBeenCalled()
    })
  })
})
