// Human Design canon. DO NOT modify without a published reference.
//
// The channel list mirrors the shipping renderer at thedesignreader.com
// (~/Downloads/site 3/assets/js/bodygraph.js) one-to-one: same ids, same
// (a, b) gate pair ordering. Preserving the site's ordering means an id
// like "14-2" or "41-30" (which look "reversed" versus a sorted list) is
// intentional — do not sort.

import type { Center } from "@/services/chart"

/**
 * The 64 gates and their centers.
 *
 * DERIVED from the site's CHANNELS + CHANNEL_CENTERS via
 * scripts/derive-gate-to-center.js — not hand-transcribed. Every channel
 * `{id, a, b}` in the site file has a matching CHANNEL_CENTERS[id] =
 * [centerA, centerB], and gate `a` lives on centerA while gate `b` lives
 * on centerB. Iterating over all 36 channels yields all 64 gates.
 *
 * Cardinalities verified: Head 3, Ajna 6, Throat 11, G 8, Heart 4,
 * Spleen 7, Solar Plexus 7, Sacral 9, Root 9 = 64 total. No gate is
 * assigned to two different centers; every gate 1-64 is present.
 *
 * Gates are listed in ascending numeric order per center for reviewability.
 */
export const GATE_TO_CENTER: Readonly<Record<number, Center>> = {
  // Head (3)
  61: "Head", 63: "Head", 64: "Head",
  // Ajna (6)
  4: "Ajna", 11: "Ajna", 17: "Ajna", 24: "Ajna", 43: "Ajna", 47: "Ajna",
  // Throat (11)
  8: "Throat", 12: "Throat", 16: "Throat", 20: "Throat", 23: "Throat",
  31: "Throat", 33: "Throat", 35: "Throat", 45: "Throat", 56: "Throat",
  62: "Throat",
  // G (8)
  1: "G", 2: "G", 7: "G", 10: "G", 13: "G", 15: "G", 25: "G", 46: "G",
  // Heart (4)
  21: "Heart", 26: "Heart", 40: "Heart", 51: "Heart",
  // Spleen (7)
  18: "Spleen", 28: "Spleen", 32: "Spleen", 44: "Spleen", 48: "Spleen",
  50: "Spleen", 57: "Spleen",
  // Solar Plexus (7)
  6: "Solar Plexus", 22: "Solar Plexus", 30: "Solar Plexus",
  36: "Solar Plexus", 37: "Solar Plexus", 49: "Solar Plexus",
  55: "Solar Plexus",
  // Sacral (9)
  3: "Sacral", 5: "Sacral", 9: "Sacral", 14: "Sacral", 27: "Sacral",
  29: "Sacral", 34: "Sacral", 42: "Sacral", 59: "Sacral",
  // Root (9)
  19: "Root", 38: "Root", 39: "Root", 41: "Root", 52: "Root",
  53: "Root", 54: "Root", 58: "Root", 60: "Root",
}

/**
 * The 36 channels. `id`, `a`, `b` match the site's CHANNELS array exactly.
 * `a` is the start gate of the drawn path, `b` is the end — preserved so
 * ids like "14-2" and "41-30" stay canonical against the site.
 */
export interface ChannelCanon {
  id: string
  a: number
  b: number
}

export const CHANNELS: ReadonlyArray<Readonly<ChannelCanon>> = [
  { id: "64-47", a: 64, b: 47 },
  { id: "61-24", a: 61, b: 24 },
  { id: "63-4",  a: 63, b: 4 },
  { id: "17-62", a: 17, b: 62 },
  { id: "43-23", a: 43, b: 23 },
  { id: "11-56", a: 11, b: 56 },
  { id: "16-48", a: 16, b: 48 },
  { id: "20-57", a: 20, b: 57 },
  { id: "10-20", a: 10, b: 20 },
  { id: "7-31",  a: 7,  b: 31 },
  { id: "1-8",   a: 1,  b: 8 },
  { id: "13-33", a: 13, b: 33 },
  { id: "25-51", a: 25, b: 51 },
  { id: "21-45", a: 21, b: 45 },
  { id: "12-22", a: 12, b: 22 },
  { id: "35-36", a: 35, b: 36 },
  { id: "10-57", a: 10, b: 57 },
  { id: "10-34", a: 10, b: 34 },
  { id: "20-34", a: 20, b: 34 },
  { id: "34-57", a: 34, b: 57 },
  { id: "26-44", a: 26, b: 44 },
  { id: "37-40", a: 37, b: 40 },
  { id: "6-59",  a: 6,  b: 59 },
  { id: "27-50", a: 27, b: 50 },
  { id: "5-15",  a: 5,  b: 15 },
  { id: "14-2",  a: 14, b: 2 },
  { id: "29-46", a: 29, b: 46 },
  { id: "42-53", a: 42, b: 53 },
  { id: "3-60",  a: 3,  b: 60 },
  { id: "9-52",  a: 9,  b: 52 },
  { id: "18-58", a: 18, b: 58 },
  { id: "28-38", a: 28, b: 38 },
  { id: "32-54", a: 32, b: 54 },
  { id: "19-49", a: 19, b: 49 },
  { id: "39-55", a: 39, b: 55 },
  { id: "41-30", a: 41, b: 30 },
]

const CHANNEL_IDS = new Set(CHANNELS.map((c) => c.id))

/**
 * Given a gate pair from the engine's `active_channels`, return the
 * canonical channel id — trying the incoming order first, then swapped,
 * to accommodate the site's mixed ordering ("14-2", "41-30", …).
 */
export const channelKey = (a: number, b: number): string => {
  const forward = `${a}-${b}`
  if (CHANNEL_IDS.has(forward)) return forward
  const reverse = `${b}-${a}`
  return CHANNEL_IDS.has(reverse) ? reverse : forward
}
