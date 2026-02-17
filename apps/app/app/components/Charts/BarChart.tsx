import { useEffect, useMemo } from "react"
import type { LayoutChangeEvent } from "react-native"
import { View } from "react-native"
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
  withDelay,
  Easing,
  interpolate,
} from "react-native-reanimated"
import Svg, { Rect, Line, Text as SvgText } from "react-native-svg"
import { StyleSheet, useUnistyles } from "react-native-unistyles"

import { Text as _Text } from "../Text"
import type { BarChartProps } from "./types"

// =============================================================================
// ANIMATED COMPONENTS
// =============================================================================

const AnimatedRect = Animated.createAnimatedComponent(Rect)

// =============================================================================
// HELPERS
// =============================================================================

const DEFAULT_PADDING = { top: 20, right: 20, bottom: 40, left: 50 }
const DEFAULT_COLORS = [
  "#0EA5E9", // primary blue
  "#A855F7", // purple
  "#22C55E", // green
  "#F97316", // orange
  "#EF4444", // red
  "#F59E0B", // amber
]

// =============================================================================
// ANIMATED BAR COMPONENT
// =============================================================================

interface AnimatedBarProps {
  x: number
  y: number
  width: number
  height: number
  color: string
  radius: number
  index: number
  animated: boolean
  orientation: "vertical" | "horizontal"
  _chartHeight: number
  baseY: number
}

function AnimatedBar({
  x,
  y,
  width,
  height,
  color,
  radius,
  index,
  animated,
  orientation,
  _chartHeight,
  baseY,
}: AnimatedBarProps) {
  const progress = useSharedValue(0)

  useEffect(() => {
    if (animated) {
      progress.value = 0
      progress.value = withDelay(
        index * 50,
        withTiming(1, {
          duration: 500,
          easing: Easing.out(Easing.cubic),
        }),
      )
    } else {
      progress.value = 1
    }
  }, [animated, index, progress])

  const animatedProps = useAnimatedProps(() => {
    if (orientation === "vertical") {
      const animatedHeight = interpolate(progress.value, [0, 1], [0, height])
      const animatedY = baseY - animatedHeight
      return {
        height: animatedHeight,
        y: animatedY,
        width,
      }
    } else {
      const animatedWidth = interpolate(progress.value, [0, 1], [0, width])
      return {
        width: animatedWidth,
        height,
        y,
      }
    }
  })

  return (
    <AnimatedRect
      x={x}
      y={y}
      width={width}
      height={height}
      fill={color}
      rx={radius}
      ry={radius}
      animatedProps={animatedProps}
    />
  )
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * A bar chart component for comparing categorical data.
 *
 * @example
 * // Basic vertical bar chart
 * <BarChart
 *   data={[
 *     { label: "Jan", value: 100 },
 *     { label: "Feb", value: 200 },
 *     { label: "Mar", value: 150 },
 *   ]}
 *   height={200}
 * />
 *
 * // Horizontal bar chart with custom colors
 * <BarChart
 *   data={[
 *     { label: "Product A", value: 450, color: "#22C55E" },
 *     { label: "Product B", value: 320, color: "#0EA5E9" },
 *     { label: "Product C", value: 280, color: "#A855F7" },
 *   ]}
 *   orientation="horizontal"
 *   height={200}
 *   showValues
 * />
 */
export function BarChart(props: BarChartProps) {
  const {
    data,
    width: propWidth,
    height = 200,
    padding: propPadding,
    showGrid = true,
    showLabels = true,
    showValues = false,
    orientation = "vertical",
    barRadius = 4,
    barGap = 0.3,
    barColor,
    animated = true,
    style,
    testID,
  } = props

  const { theme } = useUnistyles()
  const containerWidth = useSharedValue(propWidth || 300)

  const padding = useMemo(
    () => ({
      ...DEFAULT_PADDING,
      ...(orientation === "horizontal" ? { left: 80 } : {}),
      ...propPadding,
    }),
    [orientation, propPadding],
  )

  const handleLayout = (event: LayoutChangeEvent) => {
    if (!propWidth) {
      containerWidth.value = event.nativeEvent.layout.width
    }
  }

  // Calculate chart dimensions and bars
  const chartData = useMemo(() => {
    const chartWidth = (propWidth || containerWidth.value) - padding.left - padding.right
    const chartHeight = height - padding.top - padding.bottom

    // Find min/max value
    const allValues = data.map((d) => d.value).filter((v) => Number.isFinite(v))
    const hasData = allValues.length > 0
    const maxValue = hasData ? Math.max(...allValues) : 0
    const minValue = hasData ? Math.min(0, ...allValues) : 0

    // Calculate nice round numbers for axis
    const valueRange = maxValue - minValue || 1
    const axisSteps = 5
    const rawStepSize = valueRange / axisSteps
    const stepSize = rawStepSize > 0 ? Math.ceil(rawStepSize / 10) * 10 : 1
    const axisMax = Math.ceil(maxValue / stepSize) * stepSize
    const axisMin = Math.floor(minValue / stepSize) * stepSize
    const axisRange = axisMax - axisMin || 1

    // Calculate bar dimensions
    const barCount = data.length
    const totalGap = barGap * barCount
    const barSpace = orientation === "vertical" ? chartWidth : chartHeight

    const barSize = barSpace / (barCount + totalGap || 1)
    const gapSize = barCount > 0 ? barSize * barGap : 0

    const bars = data.map((item, index) => {
      const color = item.color || barColor || DEFAULT_COLORS[index % DEFAULT_COLORS.length]
      const valueRatio = (item.value - axisMin) / axisRange

      if (orientation === "vertical") {
        const barHeight = valueRatio * chartHeight
        const x = padding.left + index * (barSize + gapSize) + gapSize / 2
        const y = padding.top + chartHeight - barHeight

        return {
          ...item,
          x,
          y,
          width: barSize,
          height: barHeight,
          color,
          baseY: padding.top + chartHeight,
        }
      } else {
        const barWidth = valueRatio * chartWidth
        const y = padding.top + index * (barSize + gapSize) + gapSize / 2

        return {
          ...item,
          x: padding.left,
          y,
          width: barWidth,
          height: barSize,
          color,
          baseY: padding.top,
        }
      }
    })

    // Generate axis labels
    const axisLabels = Array.from({ length: axisSteps + 1 }, (_, i) => {
      const value = axisMin + (axisRange / axisSteps) * i
      const position =
        orientation === "vertical"
          ? padding.top + chartHeight - (i / axisSteps) * chartHeight
          : padding.left + (i / axisSteps) * chartWidth

      return { value, position }
    })

    return {
      chartWidth,
      chartHeight,
      bars,
      axisLabels,
      axisMax,
    }
  }, [propWidth, containerWidth.value, height, padding, data, orientation, barGap, barColor])

  return (
    <View style={[styles.container, style]} onLayout={handleLayout} testID={testID}>
      <Svg width={propWidth || "100%"} height={height}>
        {/* Grid Lines */}
        {showGrid && (
          <>
            {chartData.axisLabels.map((label, index) => {
              if (orientation === "vertical") {
                return (
                  <Line
                    key={`grid-${index}`}
                    x1={padding.left}
                    y1={label.position}
                    x2={padding.left + chartData.chartWidth}
                    y2={label.position}
                    stroke={theme.colors.border}
                    strokeWidth={1}
                    strokeDasharray="4,4"
                    opacity={0.5}
                  />
                )
              } else {
                return (
                  <Line
                    key={`grid-${index}`}
                    x1={label.position}
                    y1={padding.top}
                    x2={label.position}
                    y2={padding.top + chartData.chartHeight}
                    stroke={theme.colors.border}
                    strokeWidth={1}
                    strokeDasharray="4,4"
                    opacity={0.5}
                  />
                )
              }
            })}
          </>
        )}

        {/* Axis Labels (Value) */}
        {showLabels &&
          chartData.axisLabels.map((label, index) => {
            if (orientation === "vertical") {
              return (
                <SvgText
                  key={`axis-${index}`}
                  x={padding.left - 8}
                  y={label.position + 4}
                  fontSize={10}
                  fill={theme.colors.foregroundSecondary}
                  textAnchor="end"
                >
                  {label.value}
                </SvgText>
              )
            } else {
              return (
                <SvgText
                  key={`axis-${index}`}
                  x={label.position}
                  y={height - 8}
                  fontSize={10}
                  fill={theme.colors.foregroundSecondary}
                  textAnchor="middle"
                >
                  {label.value}
                </SvgText>
              )
            }
          })}

        {/* Category Labels */}
        {showLabels &&
          chartData.bars.map((bar, index) => {
            if (orientation === "vertical") {
              return (
                <SvgText
                  key={`label-${index}`}
                  x={bar.x + bar.width / 2}
                  y={height - 8}
                  fontSize={10}
                  fill={theme.colors.foregroundSecondary}
                  textAnchor="middle"
                >
                  {bar.label}
                </SvgText>
              )
            } else {
              return (
                <SvgText
                  key={`label-${index}`}
                  x={padding.left - 8}
                  y={bar.y + bar.height / 2 + 4}
                  fontSize={10}
                  fill={theme.colors.foregroundSecondary}
                  textAnchor="end"
                >
                  {bar.label}
                </SvgText>
              )
            }
          })}

        {/* Bars */}
        {chartData.bars.map((bar, index) => (
          <AnimatedBar
            key={`bar-${index}`}
            x={bar.x}
            y={bar.y}
            width={bar.width}
            height={bar.height}
            color={bar.color}
            radius={barRadius}
            index={index}
            animated={animated}
            orientation={orientation}
            _chartHeight={chartData.chartHeight}
            baseY={bar.baseY}
          />
        ))}

        {/* Values on bars */}
        {showValues &&
          chartData.bars.map((bar, index) => {
            const textX = orientation === "vertical" ? bar.x + bar.width / 2 : bar.x + bar.width + 8

            const textY = orientation === "vertical" ? bar.y - 8 : bar.y + bar.height / 2 + 4

            return (
              <SvgText
                key={`value-${index}`}
                x={textX}
                y={textY}
                fontSize={10}
                fill={theme.colors.foreground}
                textAnchor={orientation === "vertical" ? "middle" : "start"}
                fontWeight="600"
              >
                {bar.value}
              </SvgText>
            )
          })}
      </Svg>
    </View>
  )
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create((_theme) => ({
  container: {
    width: "100%",
  },
}))
