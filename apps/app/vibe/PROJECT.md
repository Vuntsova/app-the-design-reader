# The Design Reader — Project Spec

**Read this file at the start of every session before writing any code.**

For agent behavior rules, see [`/CLAUDE.md`](../../../CLAUDE.md).
For Shipnative stack conventions (i18n format, storage, data fetching, screen
templates, etc.), see [`/AGENTS.md`](../../../AGENTS.md). **AGENTS.md wins on
"how"; this file owns "what" and the HD canon.**

---

## What we are building

A premium Human Design mobile app (iOS + Android) built on the Shipnative
boilerplate. Expo / React Native / TypeScript.

**The differentiator is parenting.** Emiliya wrote *The Manifestor Mom* and runs
thedesignreader.com. Competitors (Stella et al.) treat child charts as an
afterthought. We treat them as the core. Everything else is table stakes.

**The chart is the product.** Gradients and animations are presentation. If the
chart is wrong, nothing else matters. Accuracy is not negotiable.

---

## The chart engine — DO NOT REBUILD

There is an existing, working Python chart engine. **The app does not calculate
charts. The app calls the API.**

- `POST /chart` with `{date, time, location}` — local wall-clock + place name
- The API handles geocoding (LocationIQ), IANA timezone resolution
  (`timezonefinder` + `zoneinfo`), historical DST, and Swiss Ephemeris
- It returns the full activation payload

### The payload contract

**This is the ACTUAL live response**, verified against
`POST https://dtt-chart.onrender.com/chart` on 2026-07-12. Not a guess.

```
{
  input:      {name, date, time, location},
  birth_info: {input, resolved_name, lat, lng, timezone, utc_offset_hours},
  chart: {
    type:              "Manifestor" | "Generator" | "Manifesting Generator" |
                       "Projector" | "Reflector",
    strategy:          "To Inform" | ...,
    authority:         "Emotional (Solar Plexus)" | "Sacral" | "Splenic" | ...,
    profile:           "6/2",
    signature:         "Peace" | ...,
    not_self_theme:    "Anger" | ...,
    defined_centers:   ["G", "Heart", "Root", "Solar Plexus", "Spleen", "Throat"],
    undefined_centers: ["Ajna", "Head", "Sacral"],
    active_channels:   [[1,8], [10,20], [10,57], ...],
    active_gates:      [1, 8, 10, 11, ...],
    personality:       { "Sun": {degree, gate, line}, ... },   // 13 bodies
    design:            { "Sun": {degree, gate, line}, ... }    // 13 bodies
  }
}
```

**26 activations total** (13 bodies × personality/design).

Bodies: `Sun`, `Earth`, `N. Node`, `S. Node`, `Moon`, `Mercury`, `Venus`, `Mars`,
`Jupiter`, `Saturn`, `Uranus`, `Neptune`, `Pluto`.

⚠️ **The nodes are keyed `"N. Node"` and `"S. Node"` — with a space and a period.**
Handle exactly that.

⚠️ **What is NOT in the response — do not invent it:**
- No `color`, `tone`, or `base` → **no Variables / arrows.** The live engine does
  not compute them.
- No `incarnation_cross`.
- No `definition` (Single/Split/etc.) — derive it in the app from
  `defined_centers` + `active_channels` if you need it, or add it to the API.

If you need any of the above, it is an **API change**, not something to fabricate
in TypeScript.

### Chart cache version

The app caches each fetched chart alongside its profile in MMKV, tagged with
`CHART_CACHE_VERSION` (exported from
`apps/app/app/stores/profiles/profileStore.ts`). Cached charts are used as
`initialData` for React Query so saved profiles render instantly on cold
start and continue working offline.

**Any change to the payload above requires bumping `CHART_CACHE_VERSION` in
the same commit.** On mismatch, cached charts on user devices are treated as
absent and refetched. Without the bump we ship silent wrongness — new engine,
old chart, no visible difference. `/CLAUDE.md` lists this under Never.

### Rules for the app

- **Never reimplement chart math in TypeScript.** Not gate lookup, not channel
  completion, not type determination. It exists and is verified. Call the API.
- **Never let AI compute or "correct" a chart fact.** The engine calculates.
  The AI only explains what the engine already produced.
- **Server data goes through React Query.** Screens never call `getChart()` (or
  any other service function) directly, and never from `useEffect`. Wrap it in
  `useQuery({ queryKey: [...], queryFn: () => getChart(...) })`. Shipnative's
  `AGENTS.md` bans `useEffect` for data fetching, and it applies here too.
- `active_gates` is deduplicated. If you need to know *which side* activated a
  gate, read it off the `personality` / `design` objects, not the flat list.
- Node aliases exist for backward compat (`N. Node` / `NorthNode`). Handle both.

---

## Human Design — canonical definitions

**Do not invent HD semantics. If it is not in this section, ask before assuming.**

The previous AI-generated inventory got this wrong. These are the corrections.

### Geometry

| Unit  | Width      |
|-------|------------|
| Gate  | 5.625°     |
| Line  | 0.9375°    |
| Color | 0.15625°   |
| Tone  | 0.0260417° |
| Base  | 0.0052083° |

64 gates. 36 channels. 9 centers.

### Types (5)

Manifestor, Generator, Manifesting Generator, Projector, Reflector.

### Authority (strict cascade — first match wins)

1. Solar Plexus (Emotional)
2. Sacral
3. Splenic
4. Ego / Heart
5. Self-Projected (G)
6. Mental / Environmental (no inner authority)
7. Lunar (Reflectors only)

### Definition (5 states)

**None** (Reflector), Single, Split, Triple Split, Quadruple Split.

> The earlier schema listed `"Other"` as the fifth state. **That is wrong.**
> The fifth state is **No Definition**, and it is what a Reflector has. Code that
> assumes a defined center will crash or mislabel every Reflector.

### Profile

`personality_sun.line / design_sun.line` — e.g. `6/2`. It is **derived**, never
stored as a primitive.

### Compatibility

Four channel states between two charts:
- **Electromagnetic** — one person has one gate, the other has the other
- **Dominance** — one person has the whole channel, the other has neither gate
- **Compromise** — one has the whole channel, the other has one gate
- **Companionship** — both have the whole channel

**Connection Theme.** Take the union of defined centers across both people. A center counts as "defined for the pair" if either person has it defined. Count how many of the nine that is, out of nine. The number gives the standard HD relationship theme:

- **9-0 "Nowhere to Go"**: all nine defined between the two of you. Everything either of you needs is available inside the relationship. Nothing pulls either of you out into the world to find it.
- **8-1 "Have Some Fun"**: eight defined, one shared open. That single open center is the escape hatch and the reason the pair keeps things light.
- **7-2 "Work To Do"**: seven defined, two open. Real friction, real potential. The classic long-term pair. Most working marriages sit here.
- **6-3 "Better To Be Free"**: six defined, three open. A meaningful piece of what each of you needs is not in the room. Hard to sustain long-term without a lot of intentional work.
- **5-4 "Not a Relationship Anymore"**: five defined, four open. This one is not a partnership so much as a phase. You leave it changed, and it is usually not built to last.

Derived, not stored. Recompute any time the two charts are compared. Nine centers total, so the counts are always 9-0, 8-1, 7-2, 6-3, or 5-4. Nothing else.

**No numeric compatibility score. Ever.**

The earlier schema invented `summaryScores: {overall: number}`. That is astrology thinking. Delete it.

The connection chart shows mechanics, not quality. Genetic Matrix and Jovian Archive both frame their own compatibility tools that way, and every serious practitioner will say the same thing. Human Design does not tell you whether a relationship is "good," and it does not tell you one match is "better" than another. Two 7-2 pairs can be completely different experiences depending on which centers are defined, who is carrying which conditioning, and what the two people actually do about it. A percentage flattens all of that into a number, and the number will always be wrong.

If we ship a percentage, we are a dating app wearing a Human Design costume. We lose Emiliya's audience, we lose every serious practitioner, and we deserve to be compared to Co-Star. Compatibility in this app is the four channel states plus the connection theme plus the type-pair dynamic. Never a score.

---

## App structure — 5 tabs

Derived from a screen-by-screen review of 62 competitor screenshots.

### 1. Today (Home)
- Profile switcher (dropdown in header — user has multiple charts saved)
- Daily guidance card — cached once per day, not regenerated on every open
- Quick Explorations rail → BodyGraph, About You, Centers, Gates, Channels
- Your Compatibilities list
- Your Transits preview
- Wisdom (content library) carousel

### 2. My Chart
Sub-tabs: **BodyGraph / About / Centers / Gates / Channels**
- BodyGraph: interactive SVG. 9 centers, 36 channels, 64 gates. Tap a center /
  gate / channel → opens its explanation. 26 planetary activations listed down
  both sides (personality left, design right).
- About: Type, Profile, Authority & Strategy, Not-Self Theme, Signature,
  Incarnation Cross
- Centers / Gates / Channels: lists with defined/undefined state, tap → article

### 3. Compatibility
- Add relationship → **Partner / Friend / Child**
- Enter or select the other person's birth data
- Show the four channel states + center conditioning
- Show the **Connection Theme** (9-0, 8-1, 7-2, 6-3, 5-4) with a plain-language reading of what it means for this specific pair
- Show the **Type-Pair Dynamic** (see below) for every relationship, and the parenting-flavored version whenever the "other person" is a Child
- **Child mode surfaces the Parenting content and the parent-child type dynamic.** This is the moat.

**Parent-Child Type Dynamics.** Not just a content library. A first-class feature the app computes and displays for every parent + child pair the user saves. Every combination of parent-type and child-type produces a specific pattern that has a name, a known failure mode, and a known workaround. Some examples:

- Generator parent + Projector child. The parent's stamina expectations exhaust the child. What the parent experiences as a normal pace is what the child experiences as constantly on. The parent has to slow down on purpose, and treat the child's need for rest and recognition as a real signal, not laziness.
- Manifestor parent + Generator child. The parent has to inform before doing anything that affects the child, and the child's Sacral needs actual yes/no questions instead of instructions. Skip either step and the household turns into a fight over control.
- Projector parent + Manifestor child. The parent's instinct is to guide, and the child's design is to initiate. Guidance lands after the fact, not before. The parent has to let the child move first and hold the reflection for later.
- Any pair that includes a Reflector, on either side. The environment is doing half the parenting. Move the room, change schools, change the neighborhood, watch what shifts. Treat setting as a variable, not a constant.

Five types on each side gives 25 ordered parent-child combinations. The app shows the specific one for every Child profile the user adds, next to the four channel states and the connection theme. This is the material Emiliya wrote *The Manifestor Mom* around. It is the reason someone picks this app over Stella, and it is what the AI Reader draws from when a parent asks about their kid.

### 4. Transits
- Current gate + line, with the line 1–6 progression
- Activated centers / gates / channels — each showing **which planet** caused it
  and a **countdown** ("3 hr remaining" / "Long term")
- Backend scheduled job computes these; the app reads cached results

### 5. AI Reader
- Chart-aware chat
- Receives: verified chart JSON, current transit, selected relationship, approved
  HD content, conversation summary, the question
- **Never** gets raw DB access
- Never asserts a chart fact the engine didn't produce

---

## Backend

**Supabase. Decided.** The `content_blocks (key, lang)` primary key is a SQL
schema; Postgres is the natural home for it. Convex was the alternative in the
boilerplate — we are not using it.

Root `AGENTS.md` describes both providers side by side; treat the Convex
sections as non-applicable to this project.

---

## Content model

Interpretations live in the **database** (Supabase / Postgres), keyed, so copy
can change without an App Store release.

> **Notation note.** DB content keys use *dots* (`type.manifestor`,
> `parenting.manifestor_child`) — semantic namespacing for the content table.
> **This is a different key system from Shipnative's UI i18n keys**, which use
> *colons* (`settings:language`). Do not cross the streams.

```
content_blocks              -- Supabase / Postgres
  key        TEXT           e.g. "type.manifestor"
  lang       TEXT           "en" | "bg" — the two locales we maintain content for
  body       TEXT           the prose
  PRIMARY KEY (key, lang)
```

Example content keys:
```
type.manifestor
authority.splenic
profile.6_2
center.solar_plexus.undefined
gate.44.personality
channel.26_44
parenting.manifestor_child      ← the moat
compatibility.electromagnetic
```

---

## Languages

**One app. One download. Language switches inside.** We do NOT ship two apps.

Emiliya writes in both English and Bulgarian and has published a Bulgarian
children's book. Bulgarian is a real audience, not an afterthought.

### UI chrome vs HD content — two layers, two answers

**UI chrome** (buttons, labels, tab names, errors)
- Shipnative already ships an i18n system covering **8 languages**: en, ar, bg,
  es, fr, hi, ja, ko. Adding Bulgarian was the entire task on our side — the
  other six locales came free with the boilerplate.
- We do not actively translate the six inherited locales. If they drift as we
  add strings, keys fall through to `en` via i18next's `fallbackLng`. Fine.

**HD content** (the actual readings — the expensive part)
- Every type, authority, profile, center, gate, channel, parenting article.
- Hundreds of pages of prose.
- Lives in `content_blocks` (see Content Model) with a `lang` column.
- **We maintain `en` and `bg` for HD content.** Other UI locales fall back to
  English HD prose.

### How it behaves

```
User downloads The Design Reader
   ↓
Phone locale is Bulgarian?              → UI Bulgarian, HD content Bulgarian
Phone locale is one of the other 6?     → UI in that locale, HD content English
Anything else?                          → UI English, HD content English
   ↓
Settings → Language → switch anytime, persists
```

### Rules — inherited from Shipnative AGENTS.md

- **Locale files are `.ts`, not `.json`.** They export a typed `Translations`
  union derived from `apps/app/app/i18n/en.ts`. Missing keys fail at compile
  time. Our Bulgarian file lives at `apps/app/app/i18n/bg.ts`.
- **Key notation is colons, not dots.** `"settings:language"`, not
  `"settings.language"`. Reference: root `AGENTS.md` → i18n section.
- **UI strings go through `tx` props or `translate()`.** Never
  `<Text>literal</Text>`. This applies to *every* string an agent writes —
  including "temporary" placeholder text. Placeholders become permanent.

  ```tsx
  // NEVER
  <Text>Your Type</Text>

  // ALWAYS
  <Text tx="chart:yourType" />
  ```

### Language preference persistence

- **MMKV** is the local cache (`languageSwitcher.ts` handles this today —
  MMKV-only until auth exists).
- **Supabase** becomes the source of truth once auth lands, so the preference
  syncs across a user's devices. Root `AGENTS.md`'s storage table treats
  language as a Supabase-synced preference with MMKV as the fast-read cache.

### Fallback

If a key has no `bg` row yet, fall back to `en` rather than showing a blank or
an error. Translation will lag content creation; the app must not break while
it does.

### App Store

The store listing (title, description, screenshots) can be localized separately
in App Store Connect. That is a store config task, not a code task.

---

## v1 scope

**IN:**
onboarding · chart calc via API · interactive BodyGraph · core reading ·
multi-profile · Parenting content · subscription paywall

**OUT (explicitly deferred — do not build these):**
- Alignment Break / Screen Time integration — it's a screen-time app grafted onto
  an HD app. Large effort, unrelated to why anyone buys this.
- **Home-screen widgets.** Shipnative's boilerplate ships a widget system and
  `apps/app/vibe/CONTEXT.md` still describes it as a feature — that reflects
  the boilerplate, not our v1 scope. We do not build widget integrations. The
  feature flag `EXPO_PUBLIC_ENABLE_WIDGETS` stays off.
- AI credit packs (bundle AI into the subscription instead — credit packs read as
  greedy).
- Any numeric "compatibility score".

---

## Onboarding flow

**Replaces the boilerplate onboarding.** Shipnative ships a 3-step onboarding
(`OnboardingScreen.tsx`: Intro → Goal → Notifications) as its default — we
replace that entirely with the flow below when we rebuild the screen. The
boilerplate version is not our starting point; it is the thing being removed.

1. Value prop
2. Name
3. Birth date
4. Birth time (with "I don't know for sure" fallback)
5. Birth place — **autocomplete, not free text.** The API's `ALLOWED_PLACE_PAIRS`
   rejects anything that isn't city/town/village/municipality/island/country.
   A user typing "Hoffman Estates" free-hand gets a 400. Never let them type
   a string that can bounce.
6. Chart generation (loading state)
7. Reveal: Type · Profile · Authority
8. Notification permission
9. Paywall

Show a real result **before** the paywall. That is what earns the subscription.

---

## Known operational constraints

- **LocationIQ is a live dependency.** Every new chart = 1 geocode call. Requires
  `LOCATIONIQ_KEY`; unset → 503. Cache geocode results by place string. Never lose
  the user's typed birth data on a geocoder failure.
- **Swiss Ephemeris files must ship.** See `EPHEMERIS_FIX.md` in the API repo.
  Moshier fallback is silent and breaks tone/base → wrong Variables arrows.
