import { type FC } from "react"
import { View, type ViewStyle } from "react-native"
import Svg, { G, Path, Rect, Text as SvgText } from "react-native-svg"
import { useUnistyles } from "react-native-unistyles"

import type { Center, Chart, PlanetaryActivation } from "@/services/chart"

import { CHANNELS } from "./canon"
import {
  BODY_KEY_ALIAS,
  BODY_TRANSFORM,
  CENTER_PATHS,
  CHANNEL_PATHS,
  GATE_POSITIONS,
  LEDGER,
  PLANETS,
  SILHOUETTE_TRANSFORM,
  VIEWBOX,
} from "./geometry"
import { SILHOUETTE_PATH } from "./silhouette"

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

export const BodyGraph: FC<BodyGraphProps> = ({ chart, style }) => {
  const { theme } = useUnistyles()

  const definedCenters = new Set<Center>(chart.defined_centers)
  const personalityGates = new Set(
    Object.values(chart.personality).map((a) => a.gate),
  )
  const designGates = new Set(
    Object.values(chart.design).map((a) => a.gate),
  )

  const activationFor = (
    side: "personality" | "design",
    displayName: string,
  ): PlanetaryActivation | undefined => {
    const map = side === "personality" ? chart.personality : chart.design
    const engineKey = BODY_KEY_ALIAS[displayName] ?? displayName
    return (map as Record<string, PlanetaryActivation>)[engineKey]
  }

  // All colors from theme.colors.hd* tokens (added in unistyles.ts).
  const canvasFill = theme.colors.hdCanvas
  const inkColor = theme.colors.hdInk
  const mutedColor = theme.colors.hdMuted
  const definedCenterFill = theme.colors.hdDefinedCenter
  const undefinedCenterFill = theme.colors.hdUndefinedCenter
  const silhouetteFill = theme.colors.hdSilhouette
  const inactiveChannel = theme.colors.hdInactiveChannel
  const personalityColor = theme.colors.hdPersonality
  const designColor = theme.colors.hdDesign

  // Two-color activation system. "Both" reads as personality-dominant
  // because it's what the user's conscious side surfaces first.
  const stateColor = (state: GateState): string => {
    if (state === "personality" || state === "both") return personalityColor
    if (state === "design") return designColor
    return inactiveChannel
  }

  // For a channel, take the color of whichever side has the LOWER-numbered
  // gate active (a stable rule when both ends activate differently). Simpler:
  // if both are same side, use that side; if mixed, prefer personality.
  const channelStroke = (stateA: GateState, stateB: GateState): string => {
    if (stateA === "open" && stateB === "open") return inactiveChannel
    if (stateA === "personality" || stateB === "personality") return personalityColor
    if (stateA === "both" || stateB === "both") return personalityColor
    return designColor
  }

  return (
    <View style={style}>
      <Svg
        viewBox={`${VIEWBOX.minX} ${VIEWBOX.minY} ${VIEWBOX.width} ${VIEWBOX.height}`}
        width="100%"
        height="100%"
      >
        {/* Dark canvas backdrop */}
        <Rect
          x={0}
          y={0}
          width={VIEWBOX.width}
          height={VIEWBOX.height}
          fill={canvasFill}
        />

        {/* Silhouette — dark figure sitting behind everything */}
        <G transform={SILHOUETTE_TRANSFORM}>
          <Path d={SILHOUETTE_PATH} fill={silhouetteFill} opacity={0.85} />
        </G>

        {/* Body group */}
        <G transform={BODY_TRANSFORM}>
          {/* Centers — defined get light fill + soft outer glow (fake-glow
              via a wider stroke of the same color); undefined blend into the
              backdrop. */}
          {(Object.entries(CENTER_PATHS) as [Center, string][]).map(
            ([name, d]) => {
              const isDefined = definedCenters.has(name)
              if (isDefined) {
                return (
                  <Path
                    key={`c-${name}`}
                    d={d}
                    fill={definedCenterFill}
                    stroke={definedCenterFill}
                    strokeWidth={5}
                    strokeOpacity={0.35}
                    strokeLinejoin="round"
                  />
                )
              }
              return (
                <Path
                  key={`c-${name}`}
                  d={d}
                  fill={undefinedCenterFill}
                />
              )
            },
          )}

          {/* Channels — thin flat lines, NOT pipes */}
          {CHANNELS.map((channel) => {
            const stateA = classify(channel.a, personalityGates, designGates)
            const stateB = classify(channel.b, personalityGates, designGates)
            const active = stateA !== "open" || stateB !== "open"
            return (
              <Path
                key={`ch-${channel.id}`}
                d={CHANNEL_PATHS[channel.id]}
                fill="none"
                stroke={active ? channelStroke(stateA, stateB) : inactiveChannel}
                strokeWidth={active ? 2 : 1.5}
                opacity={active ? 0.95 : 0.35}
                strokeLinecap="round"
              />
            )
          })}

          {/* Gates — active: colored rounded square + white number
                       inactive: just the number in muted grey */}
          {Object.entries(GATE_POSITIONS).map(([gate, [x, y]]) => {
            const n = Number(gate)
            const state = classify(n, personalityGates, designGates)
            const active = state !== "open"
            if (active) {
              return (
                <G key={`g-${gate}`}>
                  <Rect
                    x={x - 5}
                    y={y - 5}
                    width={10}
                    height={10}
                    rx={2}
                    fill={stateColor(state)}
                  />
                  <SvgText
                    x={x}
                    y={y + 2}
                    textAnchor="middle"
                    fontSize={5.5}
                    fontWeight="700"
                    fill={inkColor}
                  >
                    {n}
                  </SvgText>
                </G>
              )
            }
            return (
              <SvgText
                key={`g-${gate}`}
                x={x}
                y={y + 2}
                textAnchor="middle"
                fontSize={5}
                fontWeight="500"
                fill={mutedColor}
              >
                {n}
              </SvgText>
            )
          })}
        </G>

        {/* Left ledger (design side, cyan) */}
        {(["design", "personality"] as const).map((side) => {
          const isLeft = side === "design"
          const columnX = isLeft ? LEDGER.designX : LEDGER.personalityX
          const accent = isLeft ? designColor : personalityColor
          return (
            <G key={`ledger-${side}`}>
              {PLANETS.map(([planetName, glyph], i) => {
                const rowY = LEDGER.rowStartY + i * LEDGER.rowStep
                const activation = activationFor(side, planetName)
                const value = activation
                  ? `${activation.gate}.${activation.line}`
                  : "—"
                return (
                  <G key={`ledger-${side}-${planetName}`}>
                    <SvgText
                      x={columnX + LEDGER.glyphCenterX}
                      y={rowY + LEDGER.glyphBaselineY}
                      textAnchor="middle"
                      fontSize={LEDGER.glyphFontSize}
                      fill={accent}
                    >
                      {glyph}
                    </SvgText>
                    <Rect
                      x={columnX + LEDGER.pillX}
                      y={rowY + LEDGER.pillY}
                      width={LEDGER.pillWidth}
                      height={LEDGER.pillHeight}
                      rx={LEDGER.pillCornerR}
                      fill={accent}
                    />
                    <SvgText
                      x={columnX + LEDGER.valueCenterX}
                      y={rowY + LEDGER.valueBaselineY}
                      textAnchor="middle"
                      fontSize={LEDGER.valueFontSize}
                      fontWeight="700"
                      fill={inkColor}
                    >
                      {value}
                    </SvgText>
                  </G>
                )
              })}
            </G>
          )
        })}
      </Svg>
    </View>
  )
}
