# Working rules for AI agents on this repo

**See also: [`AGENTS.md`](./AGENTS.md).** That file owns the Shipnative stack
and coding conventions (styling, i18n format, storage, data fetching, screen
templates). This file (CLAUDE.md) owns *how the agent works* — the behavioral
layer. When the two overlap, AGENTS.md wins on "how"; this file wins on agent
process.

**Read [`apps/app/vibe/PROJECT.md`](./apps/app/vibe/PROJECT.md) and
[`ROADMAP.md`](./ROADMAP.md) before doing anything. Every session.**

---

## How to work

- **One action at a time.** Propose it, wait for confirmation, do it, report.
  Do not chain five steps and present a fait accompli.
- **Explain only when blocked.** Otherwise just do the one thing.
- **State what you did NOT do.** If you read 3 of 12 files, say so. Do not imply
  coverage you don't have.
- If a step needs a password, Apple/Xcode install, license acceptance, an external
  account, a secret key, or is destructive — **stop and ask.**

## Never

- **Never hardcode a user-facing string.** Every string goes through `t('key')`.
  This includes "temporary" placeholder text — placeholders become permanent.
  The app ships in English and Bulgarian. See `apps/app/vibe/PROJECT.md` → Languages.
- **Never invent fields that aren't in the API response.** The live payload has
  NO `color`, `tone`, `base`, `variables`, `incarnation_cross`, or `definition`.
  If you need one, that is an API change — say so. Do not fabricate it in TypeScript.
- **Never invent Human Design semantics.** If it is not in `apps/app/vibe/PROJECT.md`, ask.
  A previous agent invented a `"compatibility score"` and an `"Other"` definition
  state. Neither exists. Both would have shipped wrong.
- **Never reimplement chart math in TypeScript.** The Python engine is live and
  verified at https://dtt-chart.onrender.com. Call it. Do not "helpfully" add a
  gate-lookup table to the app.
- **Never let the AI Reader assert a chart fact.** The engine calculates; the AI
  explains. If the engine says Splenic, the AI says Splenic.
- **Never touch `.env`, secrets, or keys.**
- **Never commit generated files, credentials, or environment files.**
- **Never `sudo`** without explaining why and getting approval.
- **Never modify the `/chart` API contract** from the app side.
- **Never change the chart engine's `/chart` payload without bumping
  `CHART_CACHE_VERSION`** in `apps/app/app/stores/profiles/profileStore.ts` in
  the same commit. Every saved profile caches its last chart response in MMKV
  keyed by that version. A payload change without a bump ships stale data
  silently to every device that already has a cached chart. This is exactly
  the failure mode `Definition of done` warns against.
- **Never build ahead of the current phase.** If asked, point at ROADMAP.md.
- **Never rewrite the lockfile silently.** Use immutable/frozen install.
- Keep `main` untouched. Work on `feature/the-design-reader`.

## Two repos — do not confuse them

- **`~/Desktop/overdue/shipnative`** — the React Native app. **This is where you work.**
- **`~/Desktop/dtt-chart-api`** — the Python chart engine. Live on Render at
  `https://dtt-chart.onrender.com`. Auto-deploys from `main` on commit.

The API is **done and verified**. Do not change it from the app side.
If you find yourself editing Python while working on the app, you are in the wrong
place — stop.

(There is also a stale `~/Desktop/deploy-updated` folder. It is not connected to
anything. Ignore it.)

## Environment (verified)

- Node **v20.19.0** (not v22+ — native deps break)
- Yarn **4.9.1** via Corepack
- Start: `yarn app:start`
- Mock Mode is active. Do not configure Supabase/Convex/RevenueCat/PostHog/Sentry
  without being asked to.

## Definition of done

A task is done when it is **verified**, not when the code is written.

The failure mode that matters most on this project is **silent wrongness** — a
chart that renders beautifully and is subtly incorrect. Prefer a check that can
fail loudly over an assumption that looks fine.

If you cannot verify something, say "I did not verify this" rather than implying
you did.
