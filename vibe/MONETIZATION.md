# Monetization Guide

This guide explains how to set up and use the monetization system in your app, which supports:
- **RevenueCat** for iOS, Android, and Web (Purchases SDK + Web Billing)
- **Mock services** for development without API keys

## Quick Start

### Development Mode (No API Keys)

The app automatically uses mock services when API keys are missing in development:

```bash
# Just run the app - mock services will be used automatically
yarn app:ios
# or
yarn app:android
# or
yarn web:dev
```

You'll see console logs indicating mock mode:
```
🔧 Mock Services Status:
  Supabase: MOCK
  PostHog: MOCK
  RevenueCat: MOCK
```

> Web note: If the RevenueCat Web key is missing, the web paywall still renders using the mock service so you can exercise the flow without a live billing configuration.

### Production Setup

#### Set Up RevenueCat (Mobile and Web)

1. Create a RevenueCat account at https://revenuecat.com
2. Create a new project
3. Configure your apps:
   - **iOS**: Add your App Store Connect app
   - **Android**: Add your Google Play app
   - **Web**: Add your web payment provider (RevenueCat Billing)
4. Get your API keys:
   - Go to Project Settings → API Keys
   - Copy the Public SDK keys: **iOS**, **Android**, and **Web** (web has its own Public SDK key)
5. Add to `.env`:
```bash
EXPO_PUBLIC_REVENUECAT_IOS_KEY=your_ios_key_here
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=your_android_key_here
EXPO_PUBLIC_REVENUECAT_WEB_KEY=your_web_key_here
```

> **⚠️ Important:** After adding API keys, you **must** create products in RevenueCat. If you see errors about "no products registered" or "offerings", this is **expected and normal** - it means your API keys are working but products haven't been created yet. These errors will disappear once you create products (see step 6).

6. Create products and entitlements:
   - Create a "pro" entitlement
   - Create subscription products (e.g., "monthly_pro", "annual_pro")
   - Link your App Store/Play Store/Web products to the entitlement
   - Add products to an Offering (typically named "default") so they can be fetched by the app

## Architecture

### Platform Detection

The app automatically detects the platform and uses the appropriate service:

```typescript
// Automatically handled by subscriptionStore
Platform.OS === 'web' → RevenueCat (Web)
Platform.OS === 'ios' → RevenueCat (iOS)
Platform.OS === 'android' → RevenueCat (Android)
```

### Subscription Store

The unified subscription store (`useSubscriptionStore`) provides a consistent API across all platforms:

```typescript
import { useSubscriptionStore } from './stores/subscriptionStore'

function MyComponent() {
  const {
    isPro,           // Boolean: is user subscribed?
    packages,        // Available subscription packages
    loading,         // Purchase in progress?
    
    fetchPackages,   // Load available packages
    purchasePackage, // Start purchase flow
    restorePurchases,// Restore previous purchases
  } = useSubscriptionStore()
  
  // Use these values in your UI
}
```

## Usage Examples

### Display Paywall

```typescript
import { PaywallScreen } from './screens/PaywallScreen'

// The PaywallScreen automatically handles platform detection
// and displays the appropriate UI
<PaywallScreen />
```

#### Web Paywall Notes

- The web paywall uses RevenueCat Web Billing. Provide `EXPO_PUBLIC_REVENUECAT_WEB_KEY` to enable real checkout.
- If the web key is missing in development, the paywall will fall back to the mock RevenueCat service so you can still test the flow.
- Configure at least one Web Billing offering in the RevenueCat dashboard; otherwise the paywall will show a “No web offering found” message.

### Check Subscription Status

```typescript
import { useSubscriptionStore } from './stores/subscriptionStore'

function FeatureGate({ children }) {
  const { isPro } = useSubscriptionStore()
  
  if (!isPro) {
    return <PaywallScreen />
  }
  
  return children
}
```

## Testing

### Mock Mode Testing

1. Remove API keys from `.env` (or don't create one)
2. Run the app
3. Navigate to Paywall screen
4. Click "Subscribe" - will succeed after a delay
5. Verify Pro status activates
6. Restart app - Pro status should persist

### Testing with Real Services

#### Web (RevenueCat Web Billing)

1. Add `EXPO_PUBLIC_REVENUECAT_WEB_KEY` to `.env`
2. Run: `yarn web:dev`
3. Log in and open the Paywall screen
4. Select a package and complete checkout (RevenueCat web modal/redirect)
5. Verify `isPro` and entitlement status update
6. Refresh the page to confirm persisted state

#### iOS (RevenueCat)

1. Add RevenueCat iOS key to `.env`
2. Set up sandbox tester in App Store Connect
3. Run: `yarn app:ios`
4. Navigate to Paywall
5. Test sandbox purchase
6. Verify subscription activates

#### Android (RevenueCat)

1. Add RevenueCat Android key to `.env`
2. Set up test account in Google Play Console
3. Run: `yarn app:android`
4. Navigate to Paywall
5. Test purchase
6. Verify subscription activates

## Webhooks

RevenueCat has built-in webhook support for all platforms:

1. Go to Project Settings → Integrations → Webhooks
2. Add your webhook URL
3. RevenueCat will automatically send events
4. Update user's subscription status in your database

## Trust Boundary

RevenueCat is the source of truth for entitlement. `useSubscriptionStore.isPro`
(and `customerInfo` / `webSubscriptionInfo`) is a **client-side UX cache** that
gets persisted to MMKV so gated screens render instantly on cold start.

Anything the user can persist to disk is editable on a jailbroken device. So:

- **Client gates (`if (!isPro) showPaywall()`) are UX, not security.** They
  decide what to render, not what to grant.
- **Server gates are security.** Any Convex mutation, Supabase RPC, or Edge
  Function that unlocks paid functionality (delivers premium content, raises
  rate limits, returns subscriber-only fields) MUST verify entitlement against
  RevenueCat directly or against a webhook-synced server table — never against
  a client-supplied `isPro` argument.
- **Webhooks close the loop.** Configure RevenueCat webhooks to a Convex
  HTTP action / Supabase Edge Function that writes entitlement state to a
  server table you can read from server functions.

If you find yourself reading `isPro` from a client argument inside a server
function, stop — that's the bug.

## Best Practices

1. **Always check `isPro` before showing premium features**
2. **Handle loading states** during purchases
3. **Show clear error messages** when purchases fail
4. **Test with mock services first** before adding real API keys
5. **Use webhooks** for production to ensure sync
6. **Provide "Restore Purchases"** button for mobile users
7. **Enforce entitlement server-side** for anything that grants real access

## Next Steps

- [ ] Set up RevenueCat account and configure apps (iOS, Android, Web)
- [ ] Add API keys to `.env`
- [ ] Test purchases on mobile and web
- [ ] Set up webhook endpoints for production
