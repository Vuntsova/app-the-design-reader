# Deployment Guide

Complete guide for deploying your Shipnative app to production on iOS, Android, and Web.

## Prerequisites

### 1. Expo Account
- Sign up at [expo.dev](https://expo.dev)
- Install EAS CLI:
  ```bash
  yarn global add eas-cli
  ```
- Login:
  ```bash
  eas login
  ```

### 2. Apple Developer Account (iOS)
- Enroll at [developer.apple.com](https://developer.apple.com) ($99/year)
- Create App ID in Apple Developer portal
- Set up App Store Connect account

### 3. Google Play Developer Account (Android)
- Sign up at [play.google.com/console](https://play.google.com/console) ($25 one-time)
- Create app in Google Play Console

### 4. Git Repository
- Push your code to GitHub, GitLab, or Bitbucket
- EAS Build will pull from your repository

---

## ⚠️ Pre-Submission Checklist

**CRITICAL: Complete ALL items below before submitting to App Store or Google Play Store to avoid rejection.**

### 1. App Metadata Configuration

Update your app's identity in `apps/app/app.json`:

```json
{
  "name": "YourAppName",           // Change from "reactnativestarterkit"
  "slug": "yourappname",           // URL-friendly version
  "version": "1.0.0",
  "ios": {
    "bundleIdentifier": "com.yourcompany.yourapp"  // Change from "com.reactnativestarterkit"
  },
  "android": {
    "package": "com.yourcompany.yourapp"           // Change from "com.reactnativestarterkit"
  }
}
```

### 2. Privacy Policy (REQUIRED)

Both Apple and Google **require a Privacy Policy URL** if your app:
- Collects user data (email, name, etc.)
- Uses analytics (PostHog)
- Uses authentication (Supabase Auth)

#### Option A: Host on Your Landing Page (Recommended)

Shipnative includes a web app in `apps/web/` where you can host your privacy policy:

1. Create `apps/web/src/app/privacy-policy/page.tsx`:

```tsx
export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
      <p className="text-gray-600 mb-6">Last updated: {new Date().toLocaleDateString()}</p>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">1. Information We Collect</h2>
        <p>We collect the following information:</p>
        <ul className="list-disc ml-6 mt-2">
          <li>Email address (for authentication)</li>
          <li>Usage analytics (anonymized via PostHog)</li>
          <li>Crash reports (via Sentry)</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">2. How We Use Your Information</h2>
        <p>Your information is used to:</p>
        <ul className="list-disc ml-6 mt-2">
          <li>Provide and improve our service</li>
          <li>Send important updates about your account</li>
          <li>Analyze usage patterns to improve user experience</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">3. Data Security</h2>
        <p>We use industry-standard encryption and security measures to protect your data.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">4. Third-Party Services</h2>
        <p>We use the following services:</p>
        <ul className="list-disc ml-6 mt-2">
          <li>Supabase (authentication and database)</li>
          <li>PostHog (analytics - anonymized)</li>
          <li>Sentry (error tracking)</li>
          <li>RevenueCat (subscription management)</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">5. Your Rights</h2>
        <p>You have the right to:</p>
        <ul className="list-disc ml-6 mt-2">
          <li>Access your personal data</li>
          <li>Request deletion of your account</li>
          <li>Opt out of analytics tracking</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">6. Contact Us</h2>
        <p>For privacy questions, contact us at: privacy@yourcompany.com</p>
      </section>
    </div>
  )
}
```

2. Deploy your web app (see [Web Deployment](#web-deployment))
3. Your Privacy Policy URL will be: `https://yourwebsite.com/privacy-policy`

#### Option B: Use Privacy Policy Generator

- [TermsFeed](https://www.termsfeed.com/privacy-policy-generator/)
- [iubenda](https://www.iubenda.com/)
- [Termly](https://termly.io/products/privacy-policy-generator/)

#### Where to Add Privacy Policy URL

**Apple App Store Connect**:
1. Go to App Information
2. Scroll to "Privacy Policy URL"
3. Enter your URL: `https://yourwebsite.com/privacy-policy`

**Google Play Console**:
1. Go to Store presence → Store listing
2. Scroll to "Privacy Policy"
3. Enter your URL

### 3. App Store Connect Setup (iOS)

Complete these in [App Store Connect](https://appstoreconnect.apple.com):

- [ ] **App Name** - Your actual app name (not "reactnativestarterkit")
- [ ] **Subtitle** - Short description (30 characters max)
- [ ] **Privacy Policy URL** - Required (see above)
- [ ] **Category** - Primary and secondary categories
- [ ] **Age Rating** - Complete questionnaire
- [ ] **App Icon** - 1024x1024px
- [ ] **Screenshots** - Required sizes: 6.7" (iPhone 14 Pro Max) and 5.5" (iPhone 8 Plus)
- [ ] **Description** - Compelling app description
- [ ] **Keywords** - Comma-separated, 100 characters max
- [ ] **Support URL** - Customer support website
- [ ] **Marketing URL** - (Optional) App website

**Privacy Details (IMPORTANT)**:
1. Click "Manage" under "App Privacy"
2. Answer questions about data collection:
   - Email Address: YES (for authentication)
   - User ID: YES (for analytics)
   - Crash Data: YES (if using Sentry)
3. Specify if data is linked to identity
4. Specify if data is used for tracking

### 4. Google Play Console Setup (Android)

Complete these in [Google Play Console](https://play.google.com/console):

- [ ] **App Name** - Your actual app name
- [ ] **Short Description** - 80 characters max
- [ ] **Full Description** - 4000 characters max
- [ ] **App Icon** - 512x512px
- [ ] **Feature Graphic** - 1024x500px (required)
- [ ] **Screenshots** - At least 2 phone screenshots
- [ ] **Privacy Policy URL** - Required
- [ ] **App Category** - Select from dropdown
- [ ] **Content Rating** - Complete questionnaire (ESRB, PEGI, etc.)
- [ ] **Target Audience** - Age groups
- [ ] **Store Listing Contact** - Email and phone

**Data Safety Section (IMPORTANT)**:
1. Go to "Data safety"
2. Answer questions:
   - Does app collect data? YES
   - Data types: Email, User ID, Crash logs
   - Is data encrypted? YES
   - Can users request deletion? YES
3. Complete all sections

### 5. Required Permission Descriptions

**iOS** - Already configured in `apps/app/app.json`:
- ✅ `NSUserTrackingUsageDescription` - Analytics tracking explanation
- ✅ `UIBackgroundModes` - Push notifications

**Android** - Permissions are auto-configured via Expo plugins.

### 6. Test Accounts (If App Requires Login)

Both stores may require demo login credentials for reviewers.

Create a test account:
```
Email: reviewer@yourapp.com
Password: TestAccount123!
```

**Where to add**:
- **iOS**: App Store Connect → App Review Information → "Sign-in required" → Add credentials
- **Android**: Google Play Console → App content → "Provide access" → Add credentials

### 7. Remove Demo/Test Features

Ensure no test or debug features are visible:
- ✅ Demo screens removed from navigation (already done)
- ✅ Console.log statements wrapped in `__DEV__` checks (already done)
- ✅ No TestFlight/Beta references in UI
- ✅ No placeholder text like "Coming soon" for core features

### 8. Build Verification

Before submitting, verify your build:

```bash
# iOS
cd apps/app
yarn prebuild:clean --platform ios
yarn compile  # Check for TypeScript errors

# Android
yarn prebuild:clean --platform android
yarn compile
```

All commands should complete **without errors**.

### 9. Test Core Functionality

Test with **real API keys** (not mock services):

- [ ] User registration works
- [ ] Login/logout works
- [ ] Password reset works
- [ ] Subscription/payment flow works (RevenueCat)
- [ ] Push notifications work (if enabled)
- [ ] Analytics events are being tracked (check PostHog dashboard)
- [ ] Errors are being tracked (check Sentry dashboard)

### 10. Review Store Policies

Read the policies to avoid common rejection reasons:

**Apple App Store Review Guidelines**:
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- Common rejections: Incomplete info, crashes, privacy violations

**Google Play Console Policies**:
- [Google Play Policy Center](https://play.google.com/about/developer-content-policy/)
- Common rejections: Missing privacy policy, inappropriate content

---

## ✅ Pre-Submission Checklist Summary

**Before clicking "Submit for Review":**

- [ ] Updated app name and bundle identifier
- [ ] Privacy Policy URL added (hosted on `apps/web/privacy-policy`)
- [ ] App Store Connect / Play Console metadata complete
- [ ] Screenshots uploaded (all required sizes)
- [ ] Test account credentials provided (if login required)
- [ ] All demo/debug features removed from production
- [ ] Build verification successful (no compile errors)
- [ ] Core functionality tested with real API keys
- [ ] Privacy/data collection questions answered accurately
- [ ] Read and understood store policies

**Estimated setup time**: 2-4 hours for first submission

---

## Environment Setup

### Production Environment Variables

Create `.env.production`:

```bash
# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-production-key

# RevenueCat (all platforms)
EXPO_PUBLIC_REVENUECAT_IOS_KEY=your-ios-key
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=your-android-key
EXPO_PUBLIC_REVENUECAT_WEB_KEY=your-web-billing-key

# PostHog
EXPO_PUBLIC_POSTHOG_API_KEY=your-api-key
EXPO_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# Sentry
EXPO_PUBLIC_SENTRY_DSN=your-dsn

# Note: Push notification credentials (FCM service account, Apple private key)
# should be stored server-side (Supabase secrets / Convex env vars), not here.
# See vibe/NOTIFICATIONS.md for setup instructions.
```

### EAS Secrets Management

Store sensitive values as EAS secrets:

```bash
# Add secrets to EAS
eas secret:create --scope project --name SUPABASE_PUBLISHABLE_KEY --value "sb_publishable_your-key"
eas secret:create --scope project --name REVENUECAT_IOS_KEY --value "your-key"
# ... add more secrets

# List secrets
eas secret:list
```

---

## iOS Deployment

### Step 1: Configure App in App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Click "My Apps" → "+" → "New App"
3. Fill in:
   - **Platform**: iOS
   - **Name**: Your app name
   - **Primary Language**: English
   - **Bundle ID**: Must match `ios.bundleIdentifier` in `app.json` (e.g., `com.yourcompany.yourapp`)
   - **SKU**: Unique identifier (e.g., `yourapp-ios-001`)

### Step 2: Update App Configuration

Edit `apps/app/app.json`:

```json
{
  "ios": {
    "bundleIdentifier": "com.yourcompany.yourapp",
    "buildNumber": "1",
    "supportsTablet": true,
    "infoPlist": {
      "UIBackgroundModes": ["remote-notification"],
      "NSCameraUsageDescription": "This app uses the camera to...",
      "NSPhotoLibraryUsageDescription": "This app accesses your photos to..."
    }
  }
}
```

### Step 3: Configure EAS Build

Edit `apps/app/eas.json`:

```json
{
  "build": {
    "production": {
      "ios": {
        "buildConfiguration": "Release",
        "enterpriseProvisioning": "universal"
      }
    }
  }
}
```

### Step 4: Build for Production

```bash
cd apps/app

# First-time setup
eas build:configure

# Build for production
eas build --platform ios --profile production
```

EAS will:
- Ask you to generate signing credentials (or use existing)
- Build your app in the cloud
- Provide a download link when complete

### Step 5: Submit to TestFlight

```bash
# Submit to TestFlight (internal testing)
eas submit --platform ios --latest
```

Or manually:
1. Download the `.ipa` file from EAS dashboard
2. Upload to App Store Connect via Transporter app
3. Go to TestFlight tab in App Store Connect
4. Add internal testers
5. Share TestFlight link

### Step 6: Submit for App Store Review

1. In App Store Connect, go to your app
2. Click "Prepare for Submission"
3. Fill in:
   - **App Information**: Description, keywords, screenshots
   - **Pricing and Availability**: Countries, pricing tier
   - **App Privacy**: Privacy policy URL, data collection details
   - **Age Rating**: Answer questionnaire
4. Upload screenshots (required sizes: 6.7", 5.5")
5. Click "Submit for Review"

**Review time**: Usually 1-3 days

---

## Android Deployment

### Step 1: Configure App in Google Play Console

1. Go to [Google Play Console](https://play.google.com/console)
2. Click "Create app"
3. Fill in:
   - **App name**: Your app name
   - **Default language**: English
   - **App or game**: App
   - **Free or paid**: Free (or Paid)
4. Complete setup tasks:
   - Privacy Policy URL
   - App category
   - Contact details

### Step 2: Update App Configuration

Edit `apps/app/app.json`:

```json
{
  "android": {
    "package": "com.yourcompany.yourapp",
    "versionCode": 1,
    "adaptiveIcon": {
      "foregroundImage": "./assets/images/app-icon-android-adaptive-foreground.png",
      "backgroundImage": "./assets/images/app-icon-android-adaptive-background.png"
    },
    "permissions": [
      "INTERNET",
      "ACCESS_NETWORK_STATE",
      "RECEIVE_BOOT_COMPLETED",
      "VIBRATE"
    ]
  }
}
```

### Step 3: Build for Production

```bash
cd apps/app

# Build for production
eas build --platform android --profile production
```

### Step 4: Submit to Internal Testing

```bash
# Submit to Google Play (internal testing track)
eas submit --platform android --latest
```

Or manually:
1. Download the `.aab` file from EAS dashboard
2. Go to Google Play Console → "Release" → "Production"
3. Click "Create new release"
4. Upload `.aab` file
5. Add release notes
6. Choose "Internal testing" track first

### Step 5: Closed Testing

1. In Google Play Console, go to "Release" → "Testing" → "Closed testing"
2. Create a new release
3. Add testers via email list or Google Group
4. Testers get opt-in link

### Step 6: Production Release

1. After testing, go to "Production" track
2. Promote release from testing or create new release
3. Add release notes
4. Submit for review

**Review time**: Usually a few hours to 1 day

---

## Web Deployment

### Option 1: Vercel (Recommended)

1. **Install Vercel CLI**:
   ```bash
   yarn global add vercel
   # or: npm install -g vercel
   ```

2. **Build for Web**:
   ```bash
   cd apps/web
   yarn build
   ```

3. **Deploy**:
   ```bash
   vercel --prod
   ```

4. **Configure Custom Domain** (optional):
   - Go to Vercel dashboard
   - Project Settings → Domains
   - Add your domain

**Note on Environment Variables:** The `app.config.ts` includes an `extra` section that passes all `EXPO_PUBLIC_*` environment variables through to `Constants.expoConfig.extra`. This is required because Metro doesn't inline `process.env.EXPO_PUBLIC_*` for web builds the same way it does for native builds. The `env.ts` file reads from `Constants.expoConfig.extra` as a fallback, so your Vercel deployments will work correctly as long as you set the environment variables in your Vercel project settings.

### Option 2: Netlify

1. **Build**:
   ```bash
   cd apps/web
   yarn build
   ```

2. **Deploy via CLI**:
   ```bash
   yarn global add netlify-cli
   # or: npm install -g netlify-cli
   netlify deploy --prod --dir=dist
   ```

3. **Or connect GitHub**:
   - Go to [netlify.com](https://netlify.com)
   - "New site from Git"
   - Connect repository
   - Build command: `yarn build`
   - Publish directory: `dist`

### Option 3: Static Hosting (S3, Cloudflare Pages, etc.)

1. **Build**:
   ```bash
   cd apps/web
   yarn build
   ```

2. **Upload `dist/` folder** to your hosting provider

---

## CI/CD with GitHub Actions

### Automated Builds on Push

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  build-ios:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: 20
          
      - name: Setup Expo
        uses: expo/expo-github-action@v8
        with:
          expo-version: latest
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
          
      - name: Install dependencies
        run: yarn install
        
      - name: Build iOS
        run: cd apps/app && eas build --platform ios --non-interactive --no-wait
        
  build-android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: 20
          
      - name: Setup Expo
        uses: expo/expo-github-action@v8
        with:
          expo-version: latest
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
          
      - name: Install dependencies
        run: yarn install
        
      - name: Build Android
        run: cd apps/app && eas build --platform android --non-interactive --no-wait
        
  deploy-web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: 20
          
      - name: Install dependencies
        run: yarn install
        
      - name: Build web
        run: cd apps/web && yarn build
        
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: apps/web
```

### Required Secrets

Add to GitHub repository → Settings → Secrets:

- `EXPO_TOKEN`: From `eas whoami` → "Access Tokens"
- `VERCEL_TOKEN`: From Vercel account settings
- `VERCEL_ORG_ID`: From Vercel project settings
- `VERCEL_PROJECT_ID`: From Vercel project settings

---

## Post-Deployment Checklist

### 1. Verify Analytics

- [ ] PostHog receiving events
- [ ] Sentry receiving errors (test with intentional crash)
- [ ] RevenueCat configured correctly

### 2. Test Core Flows

- [ ] User registration
- [ ] Login/logout
- [ ] Password reset
- [ ] Subscription purchase
- [ ] Push notifications (if enabled)
- [ ] Deep links

### 3. Monitor

**Sentry Dashboard**:
- Check for crashes
- Set up alerts for error rate spikes

**PostHog Dashboard**:
- Monitor user activity
- Track conversion funnels

**RevenueCat Dashboard**:
- Monitor subscriptions
- Track revenue

**App Store Connect / Play Console**:
- Monitor crash reports
- Read user reviews
- Track download metrics

### 4. Prepare for Updates

**Version Bumping**:

In `app.json`:
```json
{
  "version": "1.0.1",  // Semantic versioning
  "ios": {
    "buildNumber": "2"  // Increment for each build
  },
  "android": {
    "versionCode": 2  // Increment for each build
  }
}
```

**OTA Updates** (Over-the-Air):

```bash
# Publish JS-only updates without new build
eas update --branch production --message "Bug fixes"
```

Users get updates instantly without App Store/Play Store review.

---

## Troubleshooting

### Build Fails

**Error**: "Could not find matching credentials"

**Solution**:
```bash
# Clear credentials and regenerate
eas credentials
# Select "Build Credentials" → "Remove"
# Run build again - EAS will generate new credentials
```

**Error**: "Duplicate symbols" or "Linking failed"

**Solution**:
```bash
# Clean and rebuild
cd apps/app
rm -rf node_modules
yarn install
eas build --platform ios --clear-cache
```

### Submission Rejected

**iOS**: "Missing Privacy Policy"

**Solution**: Add privacy policy URL in App Store Connect → App Information

**Android**: "Sensitive permissions not declared"

**Solution**: Declare permissions in Play Console → Store presence → App content

### App Crashes on Launch

**Check Sentry** for crash reports with stack traces

**Common causes**:
- Missing environment variables
- Native module not linked properly
- JavaScript error in initialization

---

## Production Optimization

### 1. Enable Proguard (Android)

In `eas.json`:
```json
{
  "build": {
    "production": {
      "android": {
        "gradleCommand": ":app:bundleRelease"
      }
    }
  }
}
```

### 2. Optimize Bundle Size

```bash
# Analyze bundle
yarn expo export --platform web --analyze

# Remove unused dependencies
yarn autoclean --init
yarn autoclean --force
```

### 3. Enable Hermes (JavaScript engine)

In `app.json`:
```json
{
  "jsEngine": "hermes"  // Already enabled
}
```

### 4. Asset Optimization

- Use WebP for images
- Compress images before adding to project
- Use vector icons (Expo Vector Icons) instead of image icons

---

## Next Steps

- [ ] Set up monitoring dashboards
- [ ] Configure alerting for errors/crashes
- [ ] Plan OTA update strategy
- [ ] Schedule regular production builds
- [ ] Set up staged rollouts (release to 10% of users first)
- [ ] Monitor user feedback and reviews

**Congratulations!** Your app is now in production. 🎉
