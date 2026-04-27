# Patches

This directory contains `patch-package` patches applied to `node_modules` after `yarn install`. Patches run automatically via the root `postinstall` script (the package is hoisted, so the patch must live at the workspace root, not in `apps/app/`).

## Active patches

### `@bittingz+expo-widgets+3.0.2.patch`

Patches `@bittingz/expo-widgets@3.0.2` to fix two iOS build failures:

1. **`ExpoWidgetsModule.swift`** — strips out the demo `setWidgetData` function and its `Logger(logHandlers: ...)` call. The upstream code references a `MyLogHandler` symbol that does not exist in the published package, so any project that includes the module fails with `missing argument for parameter 'logHandlers' in call`. The patched module keeps only the empty `Module` definition the plugin needs.
2. **`plugin/build/ios/withPodfile.js`** — rewrites the widget target's Podfile generation. The upstream version pulls React Native into the widget extension, which (a) bloats the binary and (b) trips Xcode's `APPLICATION_EXTENSION_API_ONLY` check on every non-Sentry pod. The patch replaces it with a SwiftUI-only target and forces `APPLICATION_EXTENSION_API_ONLY = NO` across all pods.

**Remove this patch when:** the upstream `@bittingz/expo-widgets` package ships a fix for the missing `MyLogHandler` symbol AND drops the React Native dependency from the widget target's Podfile (or makes it opt-in). Verify by deleting the patch, running `yarn install`, and building for iOS.

## How to add or remove a patch

```bash
# Edit the package directly inside node_modules, then:
npx patch-package <package-name>

# This writes a new file to /patches/. Commit it.
```

To remove a patch, delete the file from `/patches/` and run `yarn install`. The next install will skip the (now missing) patch and use the unmodified package.
