/**
 * Subscription Flow Integration Tests
 *
 * Tests for complete subscription purchase flows including:
 * - Fetching offerings
 * - Purchase flow
 * - Restore purchases
 * - Pro status changes
 */

import { act, renderHook, waitFor } from "@testing-library/react-native"

import * as revenueCatService from "../../services/revenuecat"
import { useSubscriptionStore } from "../../stores/subscriptionStore"
import type { PricingPackage, SubscriptionInfo } from "../../types/subscription"

// Mock RevenueCat service
jest.mock("../../services/revenuecat", () => ({
  revenueCat: {
    platform: "revenuecat",
    configure: jest.fn(),
    getSubscriptionInfo: jest.fn(),
    getPackages: jest.fn(),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
    logIn: jest.fn(),
    logOut: jest.fn(),
    addSubscriptionUpdateListener: jest.fn(),
  },
  isRevenueCatMock: true,
}))

// Mock auth store
jest.mock("../../stores/auth", () => ({
  useAuthStore: {
    getState: jest.fn(() => ({
      user: { id: "test-user-123" },
      isAuthenticated: true,
    })),
    subscribe: jest.fn(() => jest.fn()),
  },
}))

const mockPackages: PricingPackage[] = [
  {
    id: "monthly",
    identifier: "monthly",
    title: "Monthly",
    description: "Monthly subscription",
    priceString: "$9.99",
    price: 9.99,
    currencyCode: "USD",
    billingPeriod: "monthly",
    platform: "revenuecat",
  },
  {
    id: "annual",
    identifier: "annual",
    title: "Annual",
    description: "Annual subscription",
    priceString: "$79.99",
    price: 79.99,
    currencyCode: "USD",
    billingPeriod: "annual",
    platform: "revenuecat",
  },
]

const mockSubscriptionInfo: SubscriptionInfo = {
  platform: "revenuecat",
  status: "active",
  isActive: true,
  willRenew: true,
  isTrial: false,
  expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  productId: "com.app.monthly",
  originalPurchaseDate: new Date().toISOString(),
}

const mockFreeSubscriptionInfo: SubscriptionInfo = {
  platform: "revenuecat",
  status: "none",
  isActive: false,
  willRenew: false,
  isTrial: false,
  expirationDate: null,
  productId: null,
  originalPurchaseDate: null,
}

describe("Subscription Flow Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset store state
    useSubscriptionStore.setState({
      isPro: false,
      loading: false,
      packages: [],
      customerInfo: null,
      webSubscriptionInfo: null,
      platform: "revenuecat",
    })
  })

  describe("Initialization", () => {
    it("should initialize subscription service and fetch status", async () => {
      const { result } = renderHook(() => useSubscriptionStore())

      // logIn is called when there's a user (auth mock returns a user)
      ;(revenueCatService.revenueCat.logIn as jest.Mock).mockResolvedValue({
        subscriptionInfo: mockFreeSubscriptionInfo,
      })
      ;(revenueCatService.revenueCat.getPackages as jest.Mock).mockResolvedValue(mockPackages)
      ;(revenueCatService.revenueCat.addSubscriptionUpdateListener as jest.Mock).mockReturnValue(
        undefined,
      )

      await act(async () => {
        await result.current.initialize()
      })

      await waitFor(() => {
        expect(result.current.packages).toHaveLength(2)
        expect(result.current.isPro).toBe(false)
      })

      expect(revenueCatService.revenueCat.logIn).toHaveBeenCalledWith("test-user-123")
    })

    it("should detect pro status from subscription info", async () => {
      const { result } = renderHook(() => useSubscriptionStore())

      // logIn is called when there's a user (auth mock returns a user)
      ;(revenueCatService.revenueCat.logIn as jest.Mock).mockResolvedValue({
        subscriptionInfo: mockSubscriptionInfo,
      })
      ;(revenueCatService.revenueCat.getPackages as jest.Mock).mockResolvedValue(mockPackages)
      ;(revenueCatService.revenueCat.addSubscriptionUpdateListener as jest.Mock).mockReturnValue(
        undefined,
      )

      await act(async () => {
        await result.current.initialize()
      })

      await waitFor(() => {
        expect(result.current.isPro).toBe(true)
        expect(result.current.customerInfo?.isActive).toBe(true)
      })
    })
  })

  describe("Fetch Packages", () => {
    it("should fetch available packages", async () => {
      const { result } = renderHook(() => useSubscriptionStore())

      ;(revenueCatService.revenueCat.getPackages as jest.Mock).mockResolvedValue(mockPackages)

      await act(async () => {
        await result.current.fetchPackages()
      })

      await waitFor(() => {
        expect(result.current.packages).toHaveLength(2)
        expect(result.current.packages[0].identifier).toBe("monthly")
        expect(result.current.packages[1].identifier).toBe("annual")
      })
    })

    it("should handle empty packages gracefully", async () => {
      const { result } = renderHook(() => useSubscriptionStore())

      ;(revenueCatService.revenueCat.getPackages as jest.Mock).mockResolvedValue([])

      await act(async () => {
        await result.current.fetchPackages()
      })

      await waitFor(() => {
        expect(result.current.packages).toHaveLength(0)
      })
    })

    it("should handle fetch error gracefully", async () => {
      const { result } = renderHook(() => useSubscriptionStore())

      ;(revenueCatService.revenueCat.getPackages as jest.Mock).mockRejectedValue(
        new Error("Network error"),
      )

      await act(async () => {
        await result.current.fetchPackages()
      })

      // Should not throw, packages should remain empty
      expect(result.current.packages).toHaveLength(0)
    })
  })

  describe("Purchase Flow", () => {
    it("should complete purchase successfully", async () => {
      const { result } = renderHook(() => useSubscriptionStore())

      ;(revenueCatService.revenueCat.purchasePackage as jest.Mock).mockResolvedValue({
        subscriptionInfo: mockSubscriptionInfo,
        error: null,
      })

      let purchaseResult: { error?: Error }
      await act(async () => {
        purchaseResult = await result.current.purchasePackage(mockPackages[0])
      })

      await waitFor(() => {
        expect(purchaseResult.error).toBeUndefined()
        expect(result.current.isPro).toBe(true)
        expect(result.current.customerInfo?.isActive).toBe(true)
      })
    })

    it("should handle user cancellation gracefully", async () => {
      const { result } = renderHook(() => useSubscriptionStore())

      ;(revenueCatService.revenueCat.purchasePackage as jest.Mock).mockRejectedValue({
        userCancelled: true,
      })

      let purchaseResult: { error?: Error }
      await act(async () => {
        purchaseResult = await result.current.purchasePackage(mockPackages[0])
      })

      // User cancellation should not be treated as an error
      expect(purchaseResult!.error).toBeUndefined()
      expect(result.current.isPro).toBe(false)
    })

    it("should handle purchase error", async () => {
      const { result } = renderHook(() => useSubscriptionStore())

      const purchaseError = new Error("Payment declined")
      ;(revenueCatService.revenueCat.purchasePackage as jest.Mock).mockRejectedValue(purchaseError)

      let purchaseResult: { error?: Error }
      await act(async () => {
        purchaseResult = await result.current.purchasePackage(mockPackages[0])
      })

      expect(purchaseResult!.error).toBeDefined()
      expect(purchaseResult!.error?.message).toBe("Payment declined")
      expect(result.current.isPro).toBe(false)
    })

    it("should set loading state during purchase", async () => {
      const { result } = renderHook(() => useSubscriptionStore())

      let resolvePromise: (value: unknown) => void
      const purchasePromise = new Promise((resolve) => {
        resolvePromise = resolve
      })

      ;(revenueCatService.revenueCat.purchasePackage as jest.Mock).mockReturnValue(purchasePromise)

      // Start purchase
      let purchasePromiseResult: Promise<{ error?: Error }> | undefined
      act(() => {
        purchasePromiseResult = result.current.purchasePackage(mockPackages[0])
      })

      // Loading should be true
      await waitFor(() => {
        expect(result.current.loading).toBe(true)
      })

      // Complete purchase
      resolvePromise!({
        subscriptionInfo: mockSubscriptionInfo,
        error: null,
      })

      expect(purchasePromiseResult).toBeDefined()
      await act(async () => {
        await purchasePromiseResult!
      })

      // Loading should be false
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
    })
  })

  describe("Restore Purchases", () => {
    it("should restore purchases successfully", async () => {
      const { result } = renderHook(() => useSubscriptionStore())

      ;(revenueCatService.revenueCat.restorePurchases as jest.Mock).mockResolvedValue({
        subscriptionInfo: mockSubscriptionInfo,
        error: null,
      })

      let restoreResult: { error?: Error }
      await act(async () => {
        restoreResult = await result.current.restorePurchases()
      })

      await waitFor(() => {
        // Store returns {} on success, subscriptionInfo is stored in customerInfo
        expect(restoreResult.error).toBeUndefined()
        expect(result.current.customerInfo?.isActive).toBe(true)
        expect(result.current.isPro).toBe(true)
      })
    })

    it("should handle no purchases to restore", async () => {
      const { result } = renderHook(() => useSubscriptionStore())

      ;(revenueCatService.revenueCat.restorePurchases as jest.Mock).mockResolvedValue({
        subscriptionInfo: mockFreeSubscriptionInfo,
        error: null,
      })

      let restoreResult: { error?: Error }
      await act(async () => {
        restoreResult = await result.current.restorePurchases()
      })

      await waitFor(() => {
        // Store returns {} on success, no subscriptionInfo
        expect(restoreResult.error).toBeUndefined()
        expect(result.current.isPro).toBe(false)
        expect(result.current.customerInfo?.isActive).toBe(false)
      })
    })

    it("should handle restore error", async () => {
      const { result } = renderHook(() => useSubscriptionStore())

      const restoreError = new Error("Restore failed")
      ;(revenueCatService.revenueCat.restorePurchases as jest.Mock).mockResolvedValue({
        subscriptionInfo: mockFreeSubscriptionInfo,
        error: restoreError,
      })

      let restoreResult: { error?: Error }
      await act(async () => {
        restoreResult = await result.current.restorePurchases()
      })

      expect(restoreResult!.error).toBeDefined()
    })
  })

  describe("Pro Status", () => {
    it("should check pro status correctly", async () => {
      const { result } = renderHook(() => useSubscriptionStore())

      // Set customer info with active subscription
      await act(async () => {
        result.current.setCustomerInfo(mockSubscriptionInfo)
      })

      await act(async () => {
        result.current.checkProStatus()
      })

      await waitFor(() => {
        expect(result.current.isPro).toBe(true)
      })
    })

    it("should detect expired subscription", async () => {
      const { result } = renderHook(() => useSubscriptionStore())

      // Set expired subscription
      const expiredInfo: SubscriptionInfo = {
        ...mockSubscriptionInfo,
        isActive: false,
        expirationDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
      }

      await act(async () => {
        result.current.setCustomerInfo(expiredInfo)
      })

      await act(async () => {
        result.current.checkProStatus()
      })

      await waitFor(() => {
        expect(result.current.isPro).toBe(false)
      })
    })
  })
})
