# The Design Reader — Roadmap

**Phases are sequential. A gate must be green before the next phase starts.**
Do not build ahead. If asked to, say so and point at this file.

---

## Gate 0 — Chart engine verified

**Nothing gets styled until this is green.** Not one screen. Not the tab bar.

This is the only gate that can kill the product, because a wrong chart is
invisible until a customer catches it, and then you have lost them permanently.

- [ ] Swiss Ephemeris `.se1` files shipped (`sepl_18.se1`, `semo_18.se1`)
- [ ] `swe.set_ephe_path()` points at them, not `''`
- [ ] `verify_ephemeris.py` prints **PASS** (proves no silent Moshier fallback)
- [ ] `.gitignore` / `.dockerignore` do not exclude `ephe/` or `*.se1`
- [ ] Verified in **production**, not just locally
- [ ] `test_reference_charts.py` — all cases filled in from a reference tool and
      passing:
  - [ ] Seoul 1989-03-29 → Manifestor, 6/2, Emotional (already in your README)
  - [ ] Oprah → MG, 3/5, Sacral (already in chart.py's self-test)
  - [ ] A **Reflector** (all 9 centers undefined)
  - [ ] A **line-boundary** birth (within ~2 min of a Sun line change)
  - [ ] A **DST-transition** birth
  - [ ] A **pre-1970** birth
  - [ ] A **Southern Hemisphere** birth
  - [ ] An **outer-planet tone** case near a 3/4 boundary (the Moshier canary)

**Why these cases:** they are where chart engines actually break. Reflectors break
type logic that assumes a defined center. Line boundaries break on ephemeris
precision. DST births break on fixed-offset assumptions. These are not obscure —
they are the bugs.

---

## Phase 1 — Paid MVP

The smallest thing someone will pay for.

- [ ] **i18n scaffolding (do this FIRST, before any screen)**
      - Locale files `en.json` / `bg.json`
      - Detect phone locale on launch; Bulgarian → Bulgarian, else English
      - Language switcher in Settings, persisted
      - **No hardcoded strings in components. Ever. Including placeholders.**
      - Retrofitting this later means touching every screen. Do it now.
- [ ] API client → `POST /chart` (types from the ACTUAL payload in PROJECT.md)
- [ ] Onboarding (see PROJECT.md flow)
- [ ] Birth-place **autocomplete** (never free text — `ALLOWED_PLACE_PAIRS` bounces)
- [ ] Geocode caching
- [ ] Interactive BodyGraph (SVG, tappable centers/gates/channels)
- [ ] Core reading: Type · Strategy · Authority · Profile · Not-Self · Signature
- [ ] Multi-profile (add/switch between saved charts)
- [ ] Paywall + subscription (RevenueCat)
- [ ] Content in DB, keyed, **with a `lang` column** — editable without a store release
- [ ] Fallback: missing `bg` row → serve `en`, never blank

**Ship it.** Do not wait for transits, AI, or compatibility.

> Bulgarian *content* can lag — translate over time. But the *architecture* must
> support it from day one. English-only content in a bilingual-ready app is fine.
> A monolingual app that needs retrofitting is not.

---

## Phase 2 — Daily hook

Without this you have a one-time chart tool. Nobody opens it twice.

- [ ] Backend scheduled job computes transits
- [ ] Transits tab (activated gates/channels/centers, which planet, countdown)
- [ ] Daily guidance — **cached once per day**, not regenerated per open
- [ ] Push notifications

---

## Phase 3 — The moat

This is the reason to build this app instead of downloading Stella.

- [ ] Compatibility engine — the **four channel states**, deterministic, no score
- [ ] Partner / Friend / Child modes
- [ ] **Child profiles → Parenting content**
- [ ] *The Manifestor Mom* material as the content layer

---

## Phase 4 — AI Reader

Last. It is the flashiest and the least defensible, and it is the one that can
destroy trust in a single message.

- [ ] Structured context only (verified chart + transit + approved content)
- [ ] **Validation layer: the model cannot change a calculated chart fact.**
      If the engine says Splenic authority, the AI cannot say Sacral. Ever.
- [ ] Bundle into subscription (not credit packs)
- [ ] Clear separation from medical / legal / financial advice

---

## Deferred indefinitely

- Alignment Break / Screen Time
- Home-screen widgets
- Credit packs
- Numeric compatibility scores (these don't exist in HD)
