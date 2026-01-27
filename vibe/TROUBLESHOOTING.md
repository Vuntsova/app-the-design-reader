# Troubleshooting Guide

Common issues and solutions when developing with Shipnative.

## Table of Contents

- [Setup Issues](#setup-issues)
- [Metro Bundler Issues](#metro-bundler-issues)
- [Platform-Specific Issues](#platform-specific-issues)
- [Mock Mode Issues](#mock-mode-issues)
- [Build Errors](#build-errors)
- [EAS Build Issues](#eas-build-issues)
- [Deep Linking](#deep-linking)
- [Runtime Errors](#runtime-errors)
- [Performance Issues](#performance-issues)
- [Development Tools](#development-tools)

---

## Setup Issues

### Installation Fails

**Problem**: `yarn install` fails with dependency conflicts

**Solution**:
```bash
# Clear all caches
rm -rf node_modules
rm -rf apps/*/node_modules
rm yarn.lock

# Reinstall
yarn install

# If still failing, use --force
yarn install --force
```

### Install Fails With esbuild on Node 25+

**Problem**: `yarn install` fails with `esbuild` errors on Node 25+.

**Solution**: Use Node 20 LTS (required for this repo).

```bash
# Volta (recommended)
curl https://get.volta.sh | bash
volta install node@20.19.0 yarn@4.9.1

# nvm alternative
nvm install
nvm use
```

### TypeScript Errors After Install

**Problem**: TypeScript shows errors after fresh install

**Solution**:
```bash
# Rebuild TypeScript
cd apps/app
yarn compile

# Restart TypeScript server in VS Code
# Cmd+Shift+P → "TypeScript: Restart TS Server"
```

### Environment Variables Not Loading

**Problem**: App runs but shows "Mock mode" even with `.env` file

**Solution**:

1. **Check file location**: `.env` should be in `apps/app/` directory
2. **Check variable names**: Must start with `EXPO_PUBLIC_`
3. **Restart Metro**:
   ```bash
   yarn app:start --clear
   ```
4. **Verify variables are loaded**:
   ```typescript
   console.log('Supabase URL:', process.env.EXPO_PUBLIC_SUPABASE_URL)
   ```

---

## Metro Bundler Issues

### Metro Won't Start

**Problem**: `yarn app:ios` fails with "Metro bundler error"

**Solution**:
```bash
# Clear Metro cache
yarn app:start --clear

# Or manually clear
rm -rf apps/app/.expo
rm -rf apps/app/node_modules/.cache

# Kill existing Metro processes
lsof -ti:8081 | xargs kill -9

# Restart
yarn app:ios
```

### "Unable to resolve module"

**Problem**: Error like `Unable to resolve module @/components/Button`

**Solution**:

1. **Check tsconfig.json** has path mappings:
   ```json
   {
     "compilerOptions": {
       "paths": {
         "@/*": ["./app/*"]
       }
     }
   }
   ```

2. **Restart Metro with cache clear**:
   ```bash
   yarn app:start --clear
   ```

3. **Verify file exists** at the path specified

### Haste Module Map Collision

**Problem**: "Duplicated files or mocks" error

**Solution**:
```bash
# Clear watchman
watchman watch-del-all

# Clear Metro cache
yarn app:start --clear

# If persists, check for duplicate files
find . -name "*.tsx" -o -name "*.ts" | sort | uniq -d
```

---

## Platform-Specific Issues

### iOS Simulator

#### Simulator Won't Launch

**Problem**: `yarn app:ios` builds but simulator doesn't open

**Solution**:
```bash
# List available simulators
xcrun simctl list devices

# Boot specific simulator
xcrun simctl boot "iPhone 15 Pro"

# Then run app
yarn app:ios
```

#### Using a Specific iOS Simulator Version

**Problem**: You want to use a specific iOS simulator version (e.g., iOS 26.0)

**Solution**:

Expo will automatically use the default simulator, but you can specify a specific device:

```bash
# List all available simulators with iOS versions
xcrun simctl list devices available

# Run with a specific simulator device name
cd apps/app
expo run:ios --simulator "iPhone 17 Pro"  # iOS 26.0

# Or use the device UDID for more precision
expo run:ios --simulator "D44A1507-3E39-4AA2-9662-F1CC7C832D68"

# You can also set an environment variable for all Expo commands
export EXPO_IOS_SIMULATOR_DEVICE_NAME="iPhone 17 Pro"
yarn ios
```

**Note**: The simulator version depends on your Xcode installation. To use iOS 26.0, ensure you have Xcode 16+ installed with the iOS 26.0 runtime downloaded.

#### "Command PhaseScriptExecution failed"

**Problem**: iOS build fails during pod install phase

**Solution**:
```bash
cd apps/app/ios
rm -rf Pods Podfile.lock
pod install --repo-update

# If still fails
pod deintegrate
pod install
```

#### White Screen on iOS

**Problem**: App builds successfully but shows white screen

**Solution**:

1. **Check console for errors**:
   ```bash
   # View iOS logs
   xcrun simctl spawn booted log stream --predicate 'processImagePath contains "your-app"'
   ```

2. **Common causes**:
   - JavaScript error in initialization
   - Missing font loading
   - SafeAreaView issues

3. **Debug**:
   ```typescript
   // Add to App.tsx
   console.log('App mounting...')
   ```

### Android Emulator

#### Emulator Won't Start

**Problem**: `yarn app:android` fails with "No connected devices"

**Solution**:

1. **Start emulator manually**:
   ```bash
   # List AVDs
   emulator -list-avds
   
   # Start specific AVD
   emulator -avd Pixel_5_API_33
   ```

2. **Check Android Studio** → AVD Manager → Create/start emulator

#### "SDK location not found"

**Problem**: Android build fails with SDK error

**Solution**:

Create `apps/app/android/local.properties`:
```properties
sdk.dir=/Users/YOUR_USERNAME/Library/Android/sdk
```

Or set environment variable:
```bash
export ANDROID_HOME=/Users/$USER/Library/Android/sdk
```

#### Java Version Incompatibility

**Problem**: Android build fails with cryptic error like:
```
Error resolving plugin [id: 'com.facebook.react.settings']
> 25.0.1
```

**Cause**: Java 25 is too new and incompatible with React Native's Gradle plugin. The `25.0.1` in the error message is the Java version, not a React Native version.

**Solution**: Use Java 17 (LTS) instead:

```bash
# Check available Java versions
/usr/libexec/java_home -V

# Use Java 17 for the build
JAVA_HOME=$(/usr/libexec/java_home -v 17) yarn android

# Or set permanently in your shell profile (~/.zshrc or ~/.bashrc)
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
```

**Installing Java 17**:
```bash
# macOS with Homebrew
brew install --cask temurin@17

# Or download from Adoptium
# https://adoptium.net/temurin/releases/?version=17
```

#### Gradle Build Fails

**Problem**: "Could not resolve all files for configuration"

**Solution**:
```bash
cd apps/app/android
./gradlew clean
cd ../..
yarn app:android
```

### Web Browser

#### Port Already in Use

**Problem**: "Port 8081 already in use"

**Solution**:
```bash
# Kill process on port 8081
lsof -ti:8081 | xargs kill -9

# Or use different port
yarn app:web --port 3000
```

#### CORS Errors

**Problem**: API calls fail with CORS errors on web

**Solution**:

1. **Add domain to Supabase** → Settings → API → URL Configuration
2. **Check API configuration** allows web origin
3. **Use proxy** during development (see `metro.config.js`)

#### Vercel: Missing Environment Variables

**Problem**: Expo web build deployed to Vercel fails with:
```
Missing required environment variables: supabaseUrl, supabasePublishableKey
```

**Root Cause**: Metro doesn't inline `process.env.EXPO_PUBLIC_*` for web builds the way it does for native. The `env.ts` file falls back to `Constants.expoConfig.extra`, which needs to be explicitly populated.

**Solution**: Already fixed in the boilerplate. The `app.config.ts` includes an `extra` section that passes all `EXPO_PUBLIC_*` variables through to `Constants.expoConfig.extra`:

```typescript
// In app.config.ts
return {
  ...baseConfig,
  extra: {
    ...baseConfig.extra,
    supabase_url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabase_publishable_key: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    // ... all other EXPO_PUBLIC_* vars
  },
  // ...
}
```

Just ensure your Vercel project has the environment variables set in the project settings.

---

## Mock Mode Issues

### Mock Mode Activates in Production

**Problem**: Production app using mock services

**Solution**:

1. **Verify `.env` exists** in production build
2. **Check environment loading**:
   ```typescript
   // Check if env vars are present
   if (!process.env.EXPO_PUBLIC_SUPABASE_URL) {
     console.error('Missing Supabase URL!')
   }
   ```
3. **Rebuild app** with correct environment:
   ```bash
   eas build --platform ios --profile production
   ```

### Can't Exit Mock Mode

**Problem**: Even with API keys, app uses mock services

**Solution**:

1. **Restart Metro** with cache clear:
   ```bash
   yarn app:start --clear
   ```
2. **Check service initialization** in `app.tsx`
3. **Verify API keys are valid** by testing in Postman/curl

---

## Build Errors

### "Failed to build iOS project"

**Problem**: Xcode build fails

**Common Solutions**:

**1. Clean build**:
```bash
cd apps/app/ios
xcodebuild clean
rm -rf ~/Library/Developer/Xcode/DerivedData
```

**2. Update CocoaPods**:
```bash
sudo gem install cocoapods
cd apps/app/ios
pod install --repo-update
```

**3. Check Xcode version**:
- Open Xcode → Preferences → Locations
- Ensure Command Line Tools is set

### "Task :app:mergeDebugNativeLibs FAILED"

**Problem**: Android build fails with native library error

**Solution**:
```bash
cd apps/app/android
./gradlew clean
rm -rf build app/build
cd ../..
yarn app:android
```

### Native Module Not Found

**Problem**: "Native module cannot be null" error

**Solution**:

1. **Rebuild native modules**:
   ```bash
   cd apps/app
   expo prebuild --clean
   ```

2. **For specific module** (e.g., expo-notifications):
   ```bash
   yarn add expo-notifications
   expo prebuild --clean
   ```

3. **On iOS**:
   ```bash
   cd ios
   pod install
   cd ..
   yarn app:ios
   ```

---

## EAS Build Issues

### Yarn 4.x / Corepack Conflicts

**Problem**: EAS Build fails with errors like:
- `EEXIST: file already exists` when corepack is enabled
- `ETARGET No matching version found for yarn@4.9.1` when specifying yarn version
- `Usage Error: This project is configured to use yarn` version mismatch errors

**Root Cause**: Yarn 4.x is distributed via corepack, not npm. EAS's package manager installation logic conflicts with corepack's shims.

**Solution**: Shipnative bundles Yarn 4.x directly in the repository. This approach works with any CI system including EAS.

The configuration that makes this work:

1. **Bundled Yarn binary** in `.yarn/releases/yarn-4.9.1.cjs`

2. **yarnPath configuration** in `.yarnrc.yml`:
   ```yaml
   nodeLinker: node-modules
   yarnPath: .yarn/releases/yarn-4.9.1.cjs
   ```

3. **Node version pinned** in `apps/app/eas.json`:
   ```json
   {
     "build": {
       "production": {
         "node": "20.19.0"
       }
     }
   }
   ```

**Verify it works locally**:
```bash
# Should show 4.9.1
yarn --version

# Build should work
cd apps/app
eas build --platform ios --profile development
```

**If you're upgrading an older project**:
```bash
# Download and bundle yarn
mkdir -p .yarn/releases
curl -L -o .yarn/releases/yarn-4.9.1.cjs https://repo.yarnpkg.com/4.9.1/packages/yarnpkg-cli/bin/yarn.js

# Add yarnPath to .yarnrc.yml
echo "yarnPath: .yarn/releases/yarn-4.9.1.cjs" >> .yarnrc.yml

# Commit the bundled yarn (it's ~3MB)
git add .yarn/releases/yarn-4.9.1.cjs .yarnrc.yml
git commit -m "Bundle yarn 4.9.1 for EAS compatibility"
```

**Note**: Do NOT use `corepack: true` or specify `yarn: "4.x.x"` in eas.json - the bundled yarn approach handles everything automatically.

---

## Deep Linking

### Testing Deep Links

**Important**: Expo dev builds use a different URL scheme than production builds!

- **Dev build**: `exp+yourscheme://path`
- **Prod build**: `yourscheme://path`

Test on iOS Simulator:
```bash
# For development builds (yarn ios)
xcrun simctl openurl booted "exp+yourscheme://profile"

# For production builds (EAS/TestFlight/App Store)
xcrun simctl openurl booted "yourscheme://profile"
```

Test on Android:
```bash
# For development builds
adb shell am start -a android.intent.action.VIEW -d "exp+yourscheme://profile"

# For production builds
adb shell am start -a android.intent.action.VIEW -d "yourscheme://profile"
```

**Tip**: Check your built app's `Info.plist` (iOS) or `AndroidManifest.xml` for `CFBundleURLSchemes` to verify which scheme is registered.

### Deep Link Not Working

1. **Verify scheme in `app.json`**:
   ```json
   {
     "expo": {
       "scheme": "yourscheme"
     }
   }
   ```

2. **Check you're using the correct prefix** (dev vs prod)

3. **Verify the path is configured** in `apps/app/app/navigators/linking.ts`

4. **Test the URL is valid**:
   ```typescript
   import * as Linking from 'expo-linking'

   const url = Linking.createURL('profile')
   console.log('Deep link URL:', url)
   ```

---

## Runtime Errors

### Navigation Errors

**Problem**: "The action 'NAVIGATE' with payload {"name":"Screen"} was not handled"

**Solution**:

1. **Check screen is registered** in navigator
2. **Check screen name** matches exactly (case-sensitive)
3. **Verify navigator is properly nested**

**Debug**:
```typescript
// Log available routes
import { useNavigation } from '@react-navigation/native'

const navigation = useNavigation()
console.log('Current state:', navigation.getState())
```

### "Maximum update depth exceeded"

**Problem**: Infinite re-render loop

**Common Causes**:
- Calling setState in render
- Missing dependency in useEffect
- Creating new objects/arrays in render

**Solution**:
```typescript
// ❌ BAD
const MyComponent = () => {
  const [count, setCount] = useState(0)
  setCount(count + 1) // Called every render!
  return <View />
}

// ✅ GOOD
const MyComponent = () => {
  const [count, setCount] = useState(0)
  useEffect(() => {
    setCount(count + 1)
  }, []) // Only on mount
  return <View />
}
```

### Authentication Loop

**Problem**: App repeatedly redirects between login and home

**Solution**:

1. **Check auth state persistence**:
   ```typescript
   // In authStore
   export const useAuthStore = create(
     persist(
       (set) => ({...}),
       { name: 'auth-storage' } // Ensure this is set
     )
   )
   ```

2. **Check navigation logic**:
   ```typescript
   // Avoid conditional navigation in render
   if (!isAuthenticated) {
     router.replace('/login') // This causes loops
   }
   ```

### RevenueCat "Invalid API Key" Error

**Problem**: You see `[RevenueCat] There was a credentials issue. Invalid API Key.` even though you haven't configured RevenueCat yet.

**Cause**: Your `.env` file has placeholder values like `EXPO_PUBLIC_REVENUECAT_IOS_KEY=your-ios-key`. These placeholder strings are truthy, so the SDK attempts to use them as real API keys instead of falling back to mock mode.

**Solution**:

1. **Use empty values** instead of placeholders:
   ```bash
   # In apps/app/.env
   EXPO_PUBLIC_REVENUECAT_IOS_KEY=
   EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=
   EXPO_PUBLIC_REVENUECAT_WEB_KEY=
   ```

2. **Or add real API keys** from [RevenueCat Dashboard](https://app.revenuecat.com/settings/api-keys)

**Note**: The app now detects placeholder values (starting with `your-`) and automatically falls back to mock mode.

### Subscription Purchase Fails

**Problem**: RevenueCat purchase doesn't complete

**Solution**:

1. **Check RevenueCat configuration**:
   - API keys are correct
   - Entitlements are set up
   - Products are created

2. **Test in sandbox mode** (iOS) or test account (Android)

3. **Check logs**:
   ```typescript
   try {
     const result = await purchasePackage(pkg)
     console.log('Purchase result:', result)
   } catch (error) {
     console.error('Purchase error:', error)
   }
   ```

### StoreKit "No Active Account" Errors (iOS Simulator)

**Problem**: You see errors like:
```
[StoreKit] Error enumerating unfinished transactions: Error Domain=ASDErrorDomain Code=509 "No active account"
```

**Solution**: **These errors are EXPECTED and HARMLESS** in the iOS simulator. They occur because:

1. **No Apple ID signed in**: The simulator doesn't have an active Apple ID, so StoreKit can't enumerate transactions
2. **Normal behavior**: This is how StoreKit behaves when there's no account - it's not a bug
3. **Doesn't affect functionality**: RevenueCat will still work correctly. When you test purchases, you'll be prompted to sign in with a sandbox account

**What to do**:
- ✅ **Ignore these errors** - they're informational, not breaking errors
- ✅ **Test purchases normally** - when you attempt a purchase, you'll sign in with a sandbox tester account
- ✅ **Use a real device** if you want to avoid these logs (they won't appear on devices with an active Apple ID)

**Note**: These are native iOS logs that can't be filtered by RevenueCat's log handler. They're part of StoreKit's normal operation and don't indicate any configuration issues.

---

## Performance Issues

### App Starts Slowly

**Problem**: App takes >5 seconds to load

**Solutions**:

1. **Profile startup**:
   ```typescript
   // Add to index.tsx
   const start = Date.now()
   console.log('App started in', Date.now() - start, 'ms')
   ```

2. **Lazy load screens**:
   ```typescript
   const ProfileScreen = lazy(() => import('./screens/ProfileScreen'))
   ```

3. **Reduce initial bundle**:
   - Move large dependencies to async imports
   - Use `react-native-fast-image` for images
   - Optimize assets (compress images)

### Slow List Scrolling

**Problem**: FlatList scrolls slowly or drops frames

**Solution**:

1. **Use proper optimization**:
   ```typescript
   <FlatList
     data={items}
     renderItem={renderItem}
     keyExtractor={(item) => item.id}
     removeClippedSubviews={true}
     maxToRenderPerBatch={10}
     updateCellsBatchingPeriod={50}
     initialNumToRender={10}
     windowSize={5}
   />
   ```

2. **Memoize renderItem**:
   ```typescript
   const renderItem = useCallback(({ item }) => (
     <ItemComponent item={item} />
   ), [])
   ```

3. **Use React.memo** for list items:
   ```typescript
   const ItemComponent = React.memo(({ item }) => {
     return <View>...</View>
   })
   ```

### Large Bundle Size

**Problem**: App bundle is >50MB

**Solution**:

1. **Analyze bundle**:
   ```bash
   npx react-native-bundle-visualizer
   ```

2. **Remove unused dependencies**:
   ```bash
   yarn autoclean --init
   yarn autoclean --force
   ```

3. **Use smaller alternatives**:
   - `date-fns` instead of `moment`
   - `zustand` instead of Redux
   - Remove unused icon sets

---

## Development Tools

### VS Code TypeScript Not Working

**Problem**: VS Code shows TypeScript errors incorrectly

**Solution**:

1. **Restart TS Server**: Cmd/Ctrl+Shift+P → "TypeScript: Restart TS Server"
2. **Check workspace TypeScript**: Use workspace version, not VS Code's
3. **Reload window**: Cmd/Ctrl+Shift+P → "Developer: Reload Window"

### Debugger Won't Connect

**Problem**: React Native Debugger or Chrome DevTools won't connect

**Solution**:

1. **Use new debugger**:
   - Shake device → "Open Expo Dev Tools"
   - Enable "Debug Remote JS"

2. **Use Flipper** (recommended):
   ```bash
   brew install --cask flipper
   ```

3. **Check port**: Dev tools usually run on port 19000-19003

### Hot Reload Not Working

**Problem**: Changes don't reflect in app

**Solution**:

1. **Enable Fast Refresh**: Shake device → "Enable Fast Refresh"
2. **Restart packager**:
   ```bash
   yarn app:start --clear
   ```
3. **Check file is saved**: Auto-save should be enabled

---

## Getting Help

If your issue isn't listed here:

1. **Check Expo docs**: [docs.expo.dev](https://docs.expo.dev)
2. **Check GitHub issues**: Search closed issues in dependencies
3. **Ask in Discord**: Community might have seen your issue
4. **Check Sentry**: Production errors logged there
5. **Enable verbose logging**:
   ```bash
   EXPO_DEBUG=true yarn app:ios
   ```

---

## Prevention Tips

- **Always use TypeScript**: Catches errors before runtime
- **Test in mock mode first**: Faster iteration
- **Clear cache regularly**: Prevents stale errors
- **Keep dependencies updated**: Security and bug fixes
- **Use dev dashboard**: Test different states easily
- **Monitor Sentry**: Catch production errors early
- **Read logs carefully**: Error messages usually explain the issue

**Still stuck?** Create an issue in the repository with:
- Error message (full stack trace)
- Steps to reproduce
- Environment (iOS/Android/Web, versions)
- What you've tried already
