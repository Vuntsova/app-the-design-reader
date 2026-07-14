// SVG geometry ported VERBATIM from
// ~/Downloads/site 3/assets/js/bodygraph.js (the shipping renderer at
// thedesignreader.com). Do not "improve" or round these numbers — the
// production site is the reference.
//
// Body-space coordinates are what CENTER_PATHS / GATE_POSITIONS /
// CHANNEL_PATHS use. The body group is composed onto the outer canvas via
// BODY_TRANSFORM below (matching the site's placement of centers/channels/
// gates inside the poster canvas).

import type { Center } from "@/services/chart"

// ---------------------------------------------------------------------------
// Mobile composition — VERBATIM from the shipping site's bodygraph.js when
// mobile === true (see line 581). Do not invent a composition.
//
// site viewBox     : "190 0 600 850"  (crops the desktop ledger margins)
// site art group   : translate(0 66)  (top margin above the body)
// site silhouette  : <image x=214 y=42 width=552 height=642> inside art
//                    → outer image box (214, 108) → (766, 750)
// site BODY_TRANSFORM: translate(490 84) scale(1.18 1.18) translate(-269 0)
//                    inside art → body midline at outer x=490, y=150+1.18y_bs
// site ledgers     : SKIPPED on mobile (bodygraph.js:597)
// ---------------------------------------------------------------------------

// Widened back to the site's desktop viewBox to fit the planet ledgers on
// both sides (24..204 for design, 776..956 for personality).
export const VIEWBOX = { minX: 0, minY: 0, width: 980, height: 850 }

/** ART group transform. Everything else nests inside this. */
export const ART_TRANSFORM = "translate(0 66)"

/**
 * BODY group transform, verbatim from bodygraph.js:15. Applied INSIDE the
 * art group; do not bake the art translate into this constant.
 */
export const BODY_TRANSFORM =
  "translate(490 84) scale(1.18 1.18) translate(-269 0)"

/**
 * Silhouette placement inside the art group. Reproduces the site's
 *   <image x=214 y=42 width=552 height=642 preserveAspectRatio="xMidYMid meet"/>
 * where the silhouette's own viewBox is 140 70 972 1100. Under "meet" with
 * target aspect 552:642 vs source 972:1100, width is limiting:
 *   scale = 552/972 = 0.567901
 *   letterbox = (642 - 1100*scale)/2 = 8.6543 on top/bottom
 * so the content top-left inside art lands at (214, 42+8.6543) = (214, 50.6543).
 */
export const SILHOUETTE_TRANSFORM =
  "translate(214 50.6543) scale(0.567901) translate(-140 -70)"

/** SVG path `d` for each center's outline. */
export const CENTER_PATHS: Readonly<Record<Center, string>> = {
  Head:
    "M269 15 C273 15 276 19 279 25 L295 63 C299 72 295 78 286 78 H252 C243 78 239 72 243 63 L259 25 C262 19 265 15 269 15 Z",
  Ajna:
    "M247 92 H291 C298 92 301 98 297 105 L276 136 C272 143 266 143 262 136 L241 105 C237 98 240 92 247 92 Z",
  Throat:
    "M248 158 H290 C296 158 299 162 299 168 V207 C299 213 296 217 290 217 H248 C242 217 239 213 239 207 V168 C239 162 242 158 248 158 Z",
  G:
    "M269 226 C272 226 275 228 278 231 L308 257 C312 261 312 266 308 270 L278 297 C273 302 265 302 260 297 L230 270 C226 266 226 261 230 257 L260 231 C263 228 266 226 269 226 Z",
  Heart:
    "M329 272 C333 272 336 275 338 279 L352 306 C355 312 351 317 344 316 L310 309 C303 308 301 303 306 298 L324 278 C326 275 328 272 329 272 Z",
  Spleen:
    "M149 319 C145 319 142 323 142 328 V375 C142 382 148 385 154 381 L196 358 C203 354 203 349 196 345 L154 322 C152 320 151 319 149 319 Z",
  "Solar Plexus":
    "M389 319 C393 319 396 323 396 328 V375 C396 382 390 385 384 381 L342 358 C335 354 335 349 342 345 L384 322 C386 320 387 319 389 319 Z",
  Sacral:
    "M248 326 H290 C296 326 299 330 299 336 V374 C299 380 296 384 290 384 H248 C242 384 239 380 239 374 V336 C239 330 242 326 248 326 Z",
  Root:
    "M246 396 H292 C298 396 301 400 301 406 V446 C301 452 298 456 292 456 H246 C240 456 237 452 237 446 V406 C237 400 240 396 246 396 Z",
}

/** (x, y) of every gate in body-space. All 64 gates. */
export const GATE_POSITIONS: Readonly<Record<number, readonly [number, number]>> = {
  64: [254, 68], 61: [269, 68], 63: [284, 68],
  47: [254, 97], 24: [269, 97], 4: [284, 97],
  17: [256, 116], 11: [282, 116], 43: [269, 136],
  62: [254, 166], 23: [269, 166], 56: [284, 166],
  16: [247, 181], 35: [291, 181],
  20: [247, 195], 12: [291, 195],
  45: [291, 208], 31: [255, 209], 8: [269, 209], 33: [283, 209],
  1: [269, 233], 7: [256, 248], 13: [283, 248],
  10: [230, 263], 25: [308, 263],
  15: [256, 281], 46: [282, 281], 2: [269, 296],
  21: [329, 279], 51: [333, 291], 26: [313, 303], 40: [349, 308],
  48: [147, 327], 57: [158, 337], 44: [175, 346], 50: [194, 354],
  32: [171, 365], 28: [158, 375], 18: [147, 379],
  36: [391, 327], 22: [378, 337], 37: [359, 346], 6: [343, 354],
  49: [359, 363], 55: [378, 372], 30: [391, 379],
  5: [254, 334], 14: [269, 334], 29: [284, 334],
  34: [248, 347], 27: [248, 365], 59: [290, 365],
  42: [255, 379], 3: [269, 379], 9: [284, 379],
  53: [255, 402], 60: [269, 402], 52: [284, 402],
  54: [248, 415], 19: [291, 415],
  38: [248, 431], 39: [291, 431],
  58: [255, 446], 41: [284, 446],
}

/**
 * SVG path `d` for each channel, keyed by the same id used in canon.ts
 * (`"64-47"`, `"14-2"`, `"41-30"`, …). Straight channels are `M ... L ...`;
 * curved "pipe" channels are cubic Bézier so they arc past the centers
 * they cross rather than cutting through them.
 */
export const CHANNEL_PATHS: Readonly<Record<string, string>> = {
  "64-47": "M254 68 L254 97",
  "61-24": "M269 68 L269 97",
  "63-4":  "M284 68 L284 97",
  "17-62": "M256 116 C256 132 255 150 254 166",
  "43-23": "M269 136 L269 166",
  "11-56": "M282 116 C282 132 283 150 284 166",
  "16-48": "M247 181 C194 202 153 251 147 327",
  "20-57": "M247 195 C199 217 164 267 158 337",
  "10-20": "M230 263 C226 236 233 211 247 195",
  "7-31":  "M256 248 C256 234 255 221 255 209",
  "1-8":   "M269 233 L269 209",
  "13-33": "M283 248 C283 234 283 221 283 209",
  "25-51": "M308 263 C318 272 326 281 333 291",
  "21-45": "M329 279 C321 247 308 224 291 208",
  "12-22": "M291 195 C340 216 372 270 378 337",
  "35-36": "M291 181 C349 200 387 250 391 327",
  "10-57": "M230 263 C204 270 173 298 158 337",
  "10-34": "M230 263 C216 294 222 327 248 347",
  "20-34": "M247 195 C216 239 215 309 248 347",
  "34-57": "M248 347 C219 339 186 334 158 337",
  "26-44": "M313 303 C265 296 216 314 175 346",
  "37-40": "M359 346 C356 331 353 318 349 308",
  "6-59":  "M343 354 C327 358 308 363 290 365",
  "27-50": "M248 365 C229 361 210 357 194 354",
  "5-15":  "M254 334 C255 316 255 297 256 281",
  "14-2":  "M269 334 L269 296",
  "29-46": "M284 334 C283 316 283 297 282 281",
  "42-53": "M255 379 L255 402",
  "3-60":  "M269 379 L269 402",
  "9-52":  "M284 379 L284 402",
  "18-58": "M147 379 C143 423 185 455 255 446",
  "28-38": "M158 375 C164 410 199 433 248 431",
  "32-54": "M171 365 C186 391 214 410 248 415",
  "19-49": "M291 415 C325 405 348 385 359 363",
  "39-55": "M291 431 C340 420 371 397 378 372",
  "41-30": "M284 446 C355 452 396 422 391 379",
}

// Planet ledgers are skipped on mobile (bodygraph.js:597: `if (!mobile)
// drawPlanetLedger(...)`). Nothing to configure here for the mobile composition.
