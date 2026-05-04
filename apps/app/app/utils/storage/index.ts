// Platform-specific implementations live in `./index.native.ts` (MMKV) and
// `./index.web.ts` (localStorage). Metro's platform extension resolver picks
// the correct one at bundle time. This file is a fallback re-export so
// TypeScript and Jest can resolve the module when neither extension is
// matched explicitly. Both platform files export the same public surface.
export * from "./index.native"
