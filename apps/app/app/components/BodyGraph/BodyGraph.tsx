import { type FC } from "react"
import { View, type ViewStyle } from "react-native"
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg"

import type { Center, Chart, PlanetaryActivation } from "@/services/chart"

import { CHANNELS } from "./canon"
import {
  ART_TRANSFORM,
  BODY_TRANSFORM,
  CENTER_PATHS,
  CHANNEL_PATHS,
  GATE_POSITIONS,
  SILHOUETTE_TRANSFORM,
  VIEWBOX,
} from "./geometry"
import { SILHOUETTE_PATH } from "./silhouette"

// react-native-svg omits `pathLength` from its Path types even though the
// runtime supports it; the site's channel activation halves need it to
// normalize path length to 100 for the "50 100" dasharray trick.
declare module "react-native-svg" {
  interface PathProps {
    pathLength?: number
  }
}

// bodygraph.js:9-14 constants used by the render.
const ART_WIDTH = 980
const ART_HEIGHT = 720
const MARGIN_TOP = 66
const MARGIN_BOTTOM = 64
const TOTAL_HEIGHT = ART_HEIGHT + MARGIN_TOP + MARGIN_BOTTOM

// bodygraph.js:17-44 — WEB_COLORS verbatim.
const C = {
  canvas: "#F8F5F0",
  paper: "#FFFEFC",
  ink: "#2E2931",
  muted: "#786F78",
  hairline: "#DED6CD",
  openCenter: "#FFFEFC",
  openCenterStroke: "#C9BFB5",
  openChannel: "#D8CDBB",
  channelLumen: "#FFFEFC",
  design: "#B08D4F",
  personality: "#8F83C9",
  both: "#3F315F",
  gateOpen: "#FFFEFC",
  gateOpenText: "#6C646E",
  head: ["#C9A86A", "#B08D4F"] as const,
  ajna: ["#BFA277", "#A6875A"] as const,
  throat: ["#B8935C", "#9C7A5B"] as const,
  g: ["#CBB07A", "#B49463"] as const,
  heart: ["#A8835F", "#8A6F4A"] as const,
  spleen: ["#BDA778", "#A68B62"] as const,
  solar: ["#B79A70", "#9C8058"] as const,
  sacral: ["#C09363", "#A6784C"] as const,
  root: ["#B09873", "#8F7A55"] as const,
}

// The specific "pipe" strokes for web-mode drawChannelBase (bodygraph.js:419-425).
const PIPE_OUTLINE = "#746A65"
const PIPE_LUMEN = "#F7F2EC"
const PIPE_CENTERLINE = "#D8CEC5"

// Inner circle fill inside each ledger row (bodygraph.js:385, hardcoded).
const LEDGER_ROW_CIRCLE_FILL = "#FAF7F2"

// bodygraph.js:91-128 — center → gradient id mapping.
const CENTER_GRADIENT: Record<Center, string> = {
  Head: "fill-center-head",
  Ajna: "fill-center-ajna",
  Throat: "fill-center-throat",
  G: "fill-center-g",
  Heart: "fill-center-heart",
  Spleen: "fill-center-spleen",
  "Solar Plexus": "fill-center-solar",
  Sacral: "fill-center-sacral",
  Root: "fill-center-root",
}

// bodygraph.js:79-83 — planet display order and glyphs.
const PLANETS: ReadonlyArray<readonly [string, string]> = [
  ["Sun", "☉"],
  ["Earth", "⊕"],
  ["North Node", "☊"],
  ["South Node", "☋"],
  ["Moon", "☽"],
  ["Mercury", "☿"],
  ["Venus", "♀"],
  ["Mars", "♂"],
  ["Jupiter", "♃"],
  ["Saturn", "♄"],
  ["Uranus", "♅"],
  ["Neptune", "♆"],
  ["Pluto", "♇"],
]

// The engine emits "N. Node" / "S. Node"; the site's ledger uses the display
// names above. bodygraph.js:85-88 has the equivalent ALIAS map.
const NODE_ALIAS: Record<string, string> = {
  "North Node": "N. Node",
  "South Node": "S. Node",
}

// bodygraph.js:315 — formatActivation.
function formatActivation(value: PlanetaryActivation | undefined): string {
  if (!value) return "—"
  return value.line != null
    ? `${value.gate}.${value.line}`
    : `${value.gate}`
}

export interface BodyGraphProps {
  chart: Chart
  style?: ViewStyle
}

type GateState = "both" | "personality" | "design" | "open"

const classify = (
  gate: number,
  personality: Set<number>,
  design: Set<number>,
): GateState => {
  const p = personality.has(gate)
  const d = design.has(gate)
  if (p && d) return "both"
  if (p) return "personality"
  if (d) return "design"
  return "open"
}

// bodygraph.js:311 — stateColor.
const stateColor = (state: GateState): string =>
  state === "design"
    ? C.design
    : state === "personality"
      ? C.personality
      : C.both

export const BodyGraph: FC<BodyGraphProps> = ({ chart, style }) => {
  const personalityGates = new Set(
    Object.values(chart.personality).map((a) => a.gate),
  )
  const designGates = new Set(
    Object.values(chart.design).map((a) => a.gate),
  )
  const definedCenters = new Set<Center>(chart.defined_centers)

  const sortedGateNumbers = Object.keys(GATE_POSITIONS)
    .map(Number)
    .sort((a, b) => a - b)

  // bodygraph.js:367-392 — drawPlanetLedger, ported to inline JSX.
  const renderLedger = (side: "design" | "personality") => {
    const isLeft = side === "design"
    const x = isLeft ? 24 : 776
    const width = 180
    const accent = isLeft ? C.design : C.personality
    const data = isLeft ? chart.design : chart.personality
    const label = isLeft ? "Design" : "Personality"
    return (
      <G>
        <Line
          x1={x}
          y1={72}
          x2={x + width}
          y2={72}
          stroke={accent}
          strokeWidth={2.4}
          strokeLinecap="round"
        />
        <Circle cx={x + 5} cy={60} r={3.2} fill={accent} />
        <SvgText
          x={x + 15}
          y={64}
          fontSize={15}
          fontWeight="700"
          fill={C.ink}
        >
          {label}
        </SvgText>
        {PLANETS.map(([name, symbol], index) => {
          const y = 85 + index * 39
          const key = NODE_ALIAS[name] ?? name
          const activation = (data as Record<string, PlanetaryActivation>)[key]
          const value = formatActivation(activation)
          return (
            <G key={`${side}-${name}`}>
              <Rect
                x={x}
                y={y}
                width={width}
                height={34}
                rx={8}
                fill={C.paper}
                stroke={C.hairline}
                strokeWidth={0.7}
              />
              <Circle
                cx={x + 17}
                cy={y + 17}
                r={9.6}
                fill={LEDGER_ROW_CIRCLE_FILL}
                stroke={accent}
                strokeWidth={0.8}
              />
              <SvgText
                x={x + 17}
                y={y + 21}
                textAnchor="middle"
                fontSize={13.5}
                fill={accent}
              >
                {symbol}
              </SvgText>
              <SvgText
                x={x + 34}
                y={y + 13}
                fontSize={9}
                fontWeight="700"
                letterSpacing={0.45}
                fill={C.muted}
              >
                {name.toUpperCase()}
              </SvgText>
              <SvgText
                x={x + 34}
                y={y + 27}
                fontSize={14}
                fontWeight="700"
                fill={C.ink}
              >
                {value}
              </SvgText>
            </G>
          )
        })}
      </G>
    )
  }

  return (
    <View style={style}>
      <Svg
        viewBox={`${VIEWBOX.minX} ${VIEWBOX.minY} ${VIEWBOX.width} ${VIEWBOX.height}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* bodygraph.js:588 — background rect */}
        <Rect
          x={0}
          y={0}
          width={ART_WIDTH}
          height={TOTAL_HEIGHT}
          rx={24}
          fill={C.canvas}
        />

        {/* bodygraph.js:589 — addDefinitions: 9 center gradients */}
        <Defs>
          {(
            [
              ["fill-center-head", C.head],
              ["fill-center-ajna", C.ajna],
              ["fill-center-throat", C.throat],
              ["fill-center-g", C.g],
              ["fill-center-heart", C.heart],
              ["fill-center-spleen", C.spleen],
              ["fill-center-solar", C.solar],
              ["fill-center-sacral", C.sacral],
              ["fill-center-root", C.root],
            ] as const
          ).map(([id, stops]) => (
            <LinearGradient
              key={id}
              id={id}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <Stop offset="0%" stopColor={stops[0]} />
              <Stop offset="100%" stopColor={stops[1]} />
            </LinearGradient>
          ))}
        </Defs>

        {/* bodygraph.js:594 — art group */}
        <G transform={ART_TRANSFORM}>
          {/* bodygraph.js:596 — drawMeditationSilhouette */}
          <G>
            <G transform={SILHOUETTE_TRANSFORM}>
              <Path d={SILHOUETTE_PATH} fill={C.muted} opacity={0.62} />
            </G>
          </G>

          {/* bodygraph.js:597-600 — planet ledgers (user wants them on mobile too) */}
          {renderLedger("design")}
          {renderLedger("personality")}

          {/* bodygraph.js:602 — body group */}
          <G transform={BODY_TRANSFORM}>
            {/* bodygraph.js:473 — drawCenters */}
            <G>
              {(Object.entries(CENTER_PATHS) as [Center, string][]).map(
                ([name, d]) => {
                  const isDefined = definedCenters.has(name)
                  return (
                    <Path
                      key={`center-${name}`}
                      d={d}
                      fill={
                        isDefined
                          ? `url(#${CENTER_GRADIENT[name]})`
                          : C.openCenter
                      }
                      stroke={isDefined ? "#FFFFFF" : C.openCenterStroke}
                      strokeWidth={isDefined ? 1.25 : 1.15}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )
                },
              )}
            </G>

            {/* bodygraph.js:449 — drawChannels */}
            <G>
              {CHANNELS.map((channel) => {
                const d = CHANNEL_PATHS[channel.id]
                const stateA = classify(
                  channel.a,
                  personalityGates,
                  designGates,
                )
                const stateB = classify(
                  channel.b,
                  personalityGates,
                  designGates,
                )
                return (
                  <G key={`channel-${channel.id}`}>
                    {/* bodygraph.js:418 — pipe outline (site 8.8, halved for phone) */}
                    <Path
                      d={d}
                      fill="none"
                      stroke={PIPE_OUTLINE}
                      strokeWidth={4.4}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                      pathLength={100}
                    />
                    {/* bodygraph.js:421 — pipe lumen (site 4.8, halved) */}
                    <Path
                      d={d}
                      fill="none"
                      stroke={PIPE_LUMEN}
                      strokeWidth={2.4}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                      pathLength={100}
                    />
                    {/* bodygraph.js:424 — pipe centerline (site 0.8, halved) */}
                    <Path
                      d={d}
                      fill="none"
                      stroke={PIPE_CENTERLINE}
                      strokeWidth={0.4}
                      opacity={0.72}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                      pathLength={100}
                    />
                    {/* bodygraph.js:437 — activation half a (site 4.8, halved to match lumen) */}
                    {stateA !== "open" && (
                      <Path
                        d={d}
                        fill="none"
                        stroke={stateColor(stateA)}
                        strokeWidth={2.4}
                        strokeLinecap="butt"
                        strokeLinejoin="round"
                        strokeDasharray={[50, 100]}
                        strokeDashoffset={0}
                        vectorEffect="non-scaling-stroke"
                        pathLength={100}
                      />
                    )}
                    {/* bodygraph.js:437 — activation half b (site 4.8, halved to match lumen) */}
                    {stateB !== "open" && (
                      <Path
                        d={d}
                        fill="none"
                        stroke={stateColor(stateB)}
                        strokeWidth={2.4}
                        strokeLinecap="butt"
                        strokeLinejoin="round"
                        strokeDasharray={[50, 100]}
                        strokeDashoffset={-50}
                        vectorEffect="non-scaling-stroke"
                        pathLength={100}
                      />
                    )}
                  </G>
                )
              })}
            </G>

            {/* bodygraph.js:493 — drawGates */}
            <G>
              {sortedGateNumbers.map((gate) => {
                const [x, y] = GATE_POSITIONS[gate]
                const state = classify(gate, personalityGates, designGates)
                const active = state !== "open"
                return (
                  <G key={`gate-${gate}`}>
                    <Circle
                      cx={x}
                      cy={y}
                      r={active ? 5.9 : 5.45}
                      fill={active ? stateColor(state) : C.gateOpen}
                      stroke={active ? stateColor(state) : C.hairline}
                      strokeWidth={active ? 0.75 : 0.8}
                    />
                    <SvgText
                      x={x}
                      y={y + 1.95}
                      textAnchor="middle"
                      fontSize={active ? 5.75 : 5.35}
                      fontWeight="750"
                      fill={active ? "#FFFFFF" : C.gateOpenText}
                    >
                      {gate}
                    </SvgText>
                  </G>
                )
              })}
            </G>
          </G>

          {/* bodygraph.js:555 — drawLegend */}
          <G transform="translate(350 696)">
            {(
              [
                { label: "Design", color: C.design, advance: 94 },
                { label: "Personality", color: C.personality, advance: 126 },
                { label: "Both", color: C.both, advance: 94 },
                { label: "Open", color: C.openChannel, advance: 94 },
              ] as const
            ).reduce<{ x: number; nodes: React.ReactElement[] }>(
              (acc, item) => {
                const x = acc.x
                acc.nodes.push(
                  <G key={item.label}>
                    <Line
                      x1={x}
                      y1={0}
                      x2={x + 18}
                      y2={0}
                      stroke={item.color}
                      strokeWidth={5.2}
                      strokeLinecap="round"
                    />
                    <SvgText
                      x={x + 25}
                      y={4}
                      fontSize={13}
                      fill={C.ink}
                      fontWeight="650"
                    >
                      {item.label}
                    </SvgText>
                  </G>,
                )
                return { x: acc.x + item.advance, nodes: acc.nodes }
              },
              { x: 0, nodes: [] },
            ).nodes}
          </G>
        </G>

        {/* bodygraph.js:616 — drawCopyright */}
        <G>
          <SvgText
            x={ART_WIDTH / 2}
            y={MARGIN_TOP + ART_HEIGHT + 34}
            textAnchor="middle"
            fontSize={12.5}
            fontWeight="500"
            letterSpacing={0.25}
            fill={C.muted}
          >
            {"© TheDesignReader"}
          </SvgText>
        </G>
      </Svg>
    </View>
  )
}
