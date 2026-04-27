# Error handling

The app wraps its root navigator in `<ErrorBoundary>` (`apps/app/app/components/ErrorBoundary.tsx`). When a render throws, the boundary swaps the screen for a recovery view instead of the white screen of death.

## What ErrorBoundary catches

React's `componentDidCatch` only fires for errors thrown during render, in lifecycle methods, and in constructors of components below the boundary. That is the entire scope.

## What ErrorBoundary does NOT catch

- Async code (`setTimeout`, promises, `useEffect` async work).
- Event handlers (`onPress`, `onChange`, etc.).
- Errors thrown in the boundary itself.
- Server-side errors and network failures (unless you re-throw them inside render).
- Errors that happen before React mounts (module-load crashes, native init).

For those cases you need a separate reporter. The boilerplate ships Sentry — `apps/app/app/services/sentry.ts` initializes before the app mounts, so module-load and async errors flow there. Inside event handlers, prefer explicit `try/catch` plus `Sentry.captureException(err)`. Use the boundary as a last-resort UI fallback, not a logging primitive.

## Pattern

```tsx
// In an event handler — boundary won't catch this
const onSave = async () => {
  try {
    await api.save(data)
  } catch (err) {
    Sentry.captureException(err)
    showToast("Save failed")
  }
}
```

If you want a render-time error to also reach Sentry, wire it up in `componentDidCatch` inside the boundary itself (the existing implementation already does this — check before duplicating).
