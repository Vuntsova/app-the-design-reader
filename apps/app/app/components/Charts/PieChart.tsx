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
import Svg, { Path, Text as SvgText, G } from "react-native-svg"
import { StyleSheet, useUnistyles } from "react-native-unistyles"

import { Text } from "../Text"
import type { PieChartProps } from "./types"

// =============================================================================
// ANIMATED COMPONENTS
// =============================================================================

const AnimatedPath = Animated.createAnimatedComponent(Path)

// =============================================================================
// HELPERS
// =============================================================================

const DEFAULT_COLORS = [
  "#0EA5E9", // primary blue
  "#A855F7", // purple
  "#22C55E", // green
  "#F97316", // orange
  "#EF4444", // red
  "#F59E0B", // amber
  "#14B8A6", // teal
  "#EC4899", // pink
]

function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number,
): { x: number; y: number } {
  "worklet"
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  }
}

function describeArc(
  x: number,
  y: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number,
): string {
  "worklet"
  const outerStart = polarToCartesian(x, y, outerRadius, endAngle)
  const outerEnd = polarToCartesian(x, y, outerRadius, startAngle)
  const innerStart = polarToCartesian(x, y, innerRadius, endAngle)
  const innerEnd = polarToCartesian(x, y, innerRadius, startAngle)

  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1"

  if (innerRadius === 0) {
    // Pie slice (no hole)
    return [
      "M",
      outerStart.x,
      outerStart.y,
      "A",
      outerRadius,
      outerRadius,
      0,
      largeArcFlag,
      0,
      outerEnd.x,
      outerEnd.y,
      "L",
      x,
      y,
      "Z",
    ].join(" ")
  }

  // Donut slice
  return [
    "M",
    outerStart.x,
    outerStart.y,
    "A",
    outerRadius,
    outerRadius,
    0,
    largeArcFlag,
    0,
    outerEnd.x,
    outerEnd.y,
    "L",
    innerEnd.x,
    innerEnd.y,
    "A",
    innerRadius,
    innerRadius,
    0,
    largeArcFlag,
    1,
    innerStart.x,
    innerStart.y,
    "Z",
  ].join(" ")
}

// =============================================================================
// ANIMATED SLICE COMPONENT
// =============================================================================

interface AnimatedSliceProps {
  centerX: number
  centerY: number
  outerRadius: number
  innerRadius: number
  startAngle: number
  endAngle: number
  color: string
  index: number
  animated: boolean
}

function AnimatedSlice({
  centerX,
  centerY,
  outerRadius,
  innerRadius,
  startAngle,
  endAngle,
  color,
  index,
  animated,
}: AnimatedSliceProps) {
  const progress = useSharedValue(0)

  useEffect(() => {
    if (animated) {
      progress.value = 0
      progress.value = withDelay(
        index * 100,
        withTiming(1, {
          duration: 600,
          easing: Easing.out(Easing.cubic),
        }),
      )
    } else {
      progress.value = 1
    }
  }, [animated, index, progress])

  const animatedProps = useAnimatedProps(() => {
    const animatedEndAngle = interpolate(
      progress.value,
      [0, 1],
      [startAngle + 0.01, endAngle], // Small offset to avoid path issues
    )

    const d = describeArc(centerX, centerY, outerRadius, innerRadius, startAngle, animatedEndAngle)

    return {
      d,
    }
  })

  return <AnimatedPath fill={color} animatedProps={animatedProps} />
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * A pie/donut chart component for showing proportional data.
 *
 * @example
 * // Basic pie chart
 * <PieChart
 *   data={[
 *     { label: "Desktop", value: 45 },
 *     { label: "Mobile", value: 35 },
 *     { label: "Tablet", value: 20 },
 *   ]}
 *   height={200}
 * />
 *
 * // Donut chart with percentages
 * <PieChart
 *   data={[
 *     { label: "Sales", value: 450, color: "#22C55E" },
 *     { label: "Marketing", value: 320, color: "#0EA5E9" },
 *     { label: "R&D", value: 180, color: "#A855F7" },
 *   ]}
 *   innerRadius={0.6}
 *   showPercentage
 *   showLegend
 *   height={250}
 * />
 */
export function PieChart(props: PieChartProps) {
  const {
    data,
    width: propWidth,
    height = 200,
    showLegend = true,
    showPercentage = false,
    innerRadius: innerRadiusRatio = 0,
    startAngle: initialStartAngle = 0,
    colors: customColors,
    animated = true,
    style,
    testID,
  } = props

  const { theme } = useUnistyles()
  const containerWidth = useSharedValue(propWidth || 200)

  const handleLayout = (event: LayoutChangeEvent) => {
    if (!propWidth) {
      containerWidth.value = event.nativeEvent.layout.width
    }
  }

  // Calculate pie slices
  const chartData = useMemo(() => {
    const colors = customColors || DEFAULT_COLORS
    const total = data.reduce((sum, item) => sum + item.value, 0)
    const hasPositiveTotal = total > 0

    // Calculate chart dimensions
    const size = Math.min(propWidth || containerWidth.value, height)
    const centerX = size / 2
    const centerY = size / 2
    const outerRadius = size / 2 - 10
    const innerRadius = outerRadius * innerRadiusRatio

    // Calculate slices
    let currentAngle = initialStartAngle
    const slices = data.map((item, index) => {
      const percentage = hasPositiveTotal ? (item.value / total) * 100 : 0
      const sweepAngle = hasPositiveTotal ? (item.value / total) * 360 : 0
      const startAngle = currentAngle
      const endAngle = currentAngle + sweepAngle

      // Calculate label position (middle of the arc)
      const labelAngle = startAngle + sweepAngle / 2
      const labelRadius =
        innerRadiusRatio > 0 ? (outerRadius + innerRadius) / 2 : outerRadius * 0.65
      const labelPosition = polarToCartesian(centerX, centerY, labelRadius, labelAngle)

      currentAngle = endAngle

      return {
        ...item,
        startAngle,
        endAngle,
        percentage,
        color: item.color || colors[index % colors.length],
        labelPosition,
      }
    })

    return {
      size,
      centerX,
      centerY,
      outerRadius,
      innerRadius,
      slices,
      total,
      hasPositiveTotal,
    }
  }, [
    propWidth,
    containerWidth.value,
    height,
    data,
    innerRadiusRatio,
    initialStartAngle,
    customColors,
  ])

  return (
    <View style={[styles.container, style]} onLayout={handleLayout} testID={testID}>
      <View style={styles.chartWrapper}>
        <Svg width={chartData.size} height={chartData.size}>
          <G>
            {chartData.hasPositiveTotal &&
              chartData.slices.map((slice, index) => (
                <AnimatedSlice
                  key={`slice-${index}`}
                  centerX={chartData.centerX}
                  centerY={chartData.centerY}
                  outerRadius={chartData.outerRadius}
                  innerRadius={chartData.innerRadius}
                  startAngle={slice.startAngle}
                  endAngle={slice.endAngle}
                  color={slice.color}
                  index={index}
                  animated={animated}
                />
              ))}

            {/* Percentage Labels */}
            {showPercentage &&
              chartData.hasPositiveTotal &&
              chartData.slices.map((slice, index) => {
                // Only show label if slice is big enough
                if (slice.percentage < 5) return null

                return (
                  <SvgText
                    key={`label-${index}`}
                    x={slice.labelPosition.x}
                    y={slice.labelPosition.y}
                    fontSize={12}
                    fill={theme.colors.primaryForeground}
                    textAnchor="middle"
                    alignmentBaseline="middle"
                    fontWeight="600"
                  >
                    {`${Math.round(slice.percentage)}%`}
                  </SvgText>
                )
              })}
          </G>
        </Svg>

        {/* Center label for donut charts */}
        {innerRadiusRatio > 0.3 && (
          <View style={styles.centerLabel}>
            <Text weight="bold" size="xl">
              {chartData.total}
            </Text>
            <Text size="xs" style={styles.centerLabelSub}>
              Total
            </Text>
          </View>
        )}
      </View>

      {/* Legend */}
      {showLegend && (
        <View style={styles.legend}>
          {chartData.slices.map((slice, index) => (
            <View key={`legend-${index}`} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: slice.color }]} />
              <Text text={slice.label} size="sm" style={styles.legendLabel} numberOfLines={1} />
              <Text
                text={`${slice.value} (${Math.round(slice.percentage)}%)`}
                size="xs"
                style={styles.legendValue}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create((theme) => ({
  container: {
    width: "100%",
    alignItems: "center",
  },
  chartWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  centerLabel: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  centerLabelSub: {
    color: theme.colors.foregroundSecondary,
  },
  legend: {
    marginTop: theme.spacing.lg,
    width: "100%",
    gap: theme.spacing.sm,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendLabel: {
    flex: 1,
    color: theme.colors.foreground,
  },
  legendValue: {
    color: theme.colors.foregroundSecondary,
  },
}))
