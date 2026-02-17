import { useMemo } from "react"
import type { LayoutChangeEvent } from "react-native"
import { View } from "react-native"
import Animated, { useSharedValue } from "react-native-reanimated"
import Svg, {
  Path,
  Circle,
  Line,
  Text as SvgText,
  Defs,
  LinearGradient,
  Stop,
} from "react-native-svg"
import { StyleSheet, useUnistyles } from "react-native-unistyles"

import { Text } from "../Text"
import type { LineChartProps } from "./types"

// =============================================================================
// ANIMATED COMPONENTS
// =============================================================================

const _AnimatedPath = Animated.createAnimatedComponent(Path)
const _AnimatedCircle = Animated.createAnimatedComponent(Circle)

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

function createSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return ""

  let path = `M ${points[0].x} ${points[0].y}`

  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i]
    const next = points[i + 1]
    const midX = (current.x + next.x) / 2

    path += ` C ${midX} ${current.y}, ${midX} ${next.y}, ${next.x} ${next.y}`
  }

  return path
}

function createLinearPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return ""

  return points.reduce((path, point, index) => {
    return path + (index === 0 ? `M ${point.x} ${point.y}` : ` L ${point.x} ${point.y}`)
  }, "")
}

function createAreaPath(
  points: { x: number; y: number }[],
  baseY: number,
  curveType: "linear" | "smooth",
): string {
  if (points.length < 2) return ""

  const linePath = curveType === "smooth" ? createSmoothPath(points) : createLinearPath(points)
  const firstPoint = points[0]
  const lastPoint = points[points.length - 1]

  return `${linePath} L ${lastPoint.x} ${baseY} L ${firstPoint.x} ${baseY} Z`
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * A line chart component for visualizing trends over time.
 *
 * @example
 * // Basic line chart
 * <LineChart
 *   labels={["Jan", "Feb", "Mar", "Apr", "May"]}
 *   datasets={[
 *     {
 *       id: "revenue",
 *       label: "Revenue",
 *       data: [100, 200, 150, 300, 250],
 *       color: "#0EA5E9",
 *     },
 *   ]}
 *   height={200}
 * />
 *
 * // Multi-line with area fill
 * <LineChart
 *   labels={["Mon", "Tue", "Wed", "Thu", "Fri"]}
 *   datasets={[
 *     { id: "sales", label: "Sales", data: [10, 20, 15, 25, 30], color: "#22C55E" },
 *     { id: "orders", label: "Orders", data: [5, 15, 10, 20, 25], color: "#A855F7" },
 *   ]}
 *   height={250}
 *   fillArea
 *   showDots
 *   showLegend
 * />
 */
export function LineChart(props: LineChartProps) {
  const {
    labels,
    datasets,
    width: propWidth,
    height = 200,
    padding: propPadding,
    showGrid = true,
    showLabels = true,
    showLegend = false,
    showValues = false,
    showDots = true,
    curveType = "smooth",
    fillArea = false,
    strokeWidth = 2,
    animated = true,
    style,
    testID,
  } = props

  const { theme } = useUnistyles()
  const containerWidth = useSharedValue(propWidth || 300)
  const xAxisDenominator = Math.max(labels.length - 1, 1)
  void animated

  const padding = useMemo(() => ({ ...DEFAULT_PADDING, ...propPadding }), [propPadding])

  const handleLayout = (event: LayoutChangeEvent) => {
    if (!propWidth) {
      containerWidth.value = event.nativeEvent.layout.width
    }
  }

  // Calculate chart dimensions and scale
  const chartData = useMemo(() => {
    const chartWidth = (propWidth || containerWidth.value) - padding.left - padding.right
    const chartHeight = height - padding.top - padding.bottom
    const getX = (index: number) =>
      labels.length <= 1
        ? padding.left + chartWidth / 2
        : padding.left + (index / xAxisDenominator) * chartWidth

    // Find min/max values across all datasets
    const allValues = datasets.flatMap((d) => d.data).filter((v) => Number.isFinite(v))
    const hasData = allValues.length > 0
    const minValue = hasData ? Math.min(0, ...allValues) : 0
    const maxValue = hasData ? Math.max(...allValues) : 0
    const valueRange = maxValue - minValue || 1

    // Calculate nice round numbers for y-axis
    const yAxisSteps = 5
    const rawStepSize = valueRange / yAxisSteps
    const stepSize = rawStepSize > 0 ? Math.ceil(rawStepSize / 10) * 10 : 1
    const yAxisMax = Math.ceil(maxValue / stepSize) * stepSize
    const yAxisMin = Math.floor(minValue / stepSize) * stepSize
    const yAxisRange = yAxisMax - yAxisMin || 1

    // Calculate points for each dataset
    const datasetPoints = datasets.map((dataset, datasetIndex) => {
      const points = dataset.data.map((value, index) => ({
        x: getX(index),
        y: padding.top + chartHeight - ((value - yAxisMin) / yAxisRange) * chartHeight,
        value,
      }))

      return {
        ...dataset,
        points,
        color: dataset.color || DEFAULT_COLORS[datasetIndex % DEFAULT_COLORS.length],
      }
    })

    // Generate y-axis labels
    const yAxisLabels = Array.from({ length: yAxisSteps + 1 }, (_, i) => {
      const value = yAxisMin + (yAxisRange / yAxisSteps) * i
      const y = padding.top + chartHeight - (i / yAxisSteps) * chartHeight
      return { value, y }
    })

    return {
      chartWidth,
      chartHeight,
      datasetPoints,
      yAxisLabels,
      yAxisMin,
      yAxisMax,
    }
  }, [propWidth, containerWidth.value, height, padding, datasets, labels, xAxisDenominator])

  return (
    <View style={[styles.container, style]} onLayout={handleLayout} testID={testID}>
      <Svg width={propWidth || "100%"} height={height}>
        <Defs>
          {chartData.datasetPoints.map((dataset) => (
            <LinearGradient
              key={`gradient-${dataset.id}`}
              id={`gradient-${dataset.id}`}
              x1="0%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <Stop offset="0%" stopColor={dataset.color} stopOpacity={0.3} />
              <Stop offset="100%" stopColor={dataset.color} stopOpacity={0} />
            </LinearGradient>
          ))}
        </Defs>

        {/* Grid Lines */}
        {showGrid && (
          <>
            {/* Horizontal grid lines */}
            {chartData.yAxisLabels.map((label, index) => (
              <Line
                key={`h-grid-${index}`}
                x1={padding.left}
                y1={label.y}
                x2={padding.left + chartData.chartWidth}
                y2={label.y}
                stroke={theme.colors.border}
                strokeWidth={1}
                strokeDasharray="4,4"
                opacity={0.5}
              />
            ))}
            {/* Vertical grid lines */}
            {labels.map((_, index) => {
              const x =
                labels.length <= 1
                  ? padding.left + chartData.chartWidth / 2
                  : padding.left + (index / xAxisDenominator) * chartData.chartWidth
              return (
                <Line
                  key={`v-grid-${index}`}
                  x1={x}
                  y1={padding.top}
                  x2={x}
                  y2={padding.top + chartData.chartHeight}
                  stroke={theme.colors.border}
                  strokeWidth={1}
                  strokeDasharray="4,4"
                  opacity={0.3}
                />
              )
            })}
          </>
        )}

        {/* Y-Axis Labels */}
        {showLabels &&
          chartData.yAxisLabels.map((label, index) => (
            <SvgText
              key={`y-label-${index}`}
              x={padding.left - 8}
              y={label.y + 4}
              fontSize={10}
              fill={theme.colors.foregroundSecondary}
              textAnchor="end"
            >
              {label.value}
            </SvgText>
          ))}

        {/* X-Axis Labels */}
        {showLabels &&
          labels.map((label, index) => {
            const x =
              labels.length <= 1
                ? padding.left + chartData.chartWidth / 2
                : padding.left + (index / xAxisDenominator) * chartData.chartWidth
            return (
              <SvgText
                key={`x-label-${index}`}
                x={x}
                y={height - 8}
                fontSize={10}
                fill={theme.colors.foregroundSecondary}
                textAnchor="middle"
              >
                {label}
              </SvgText>
            )
          })}

        {/* Area Fills */}
        {fillArea &&
          chartData.datasetPoints.map((dataset) => {
            const areaPath = createAreaPath(
              dataset.points,
              padding.top + chartData.chartHeight,
              curveType,
            )
            return (
              <Path key={`area-${dataset.id}`} d={areaPath} fill={`url(#gradient-${dataset.id})`} />
            )
          })}

        {/* Lines */}
        {chartData.datasetPoints.map((dataset) => {
          const linePath =
            curveType === "smooth"
              ? createSmoothPath(dataset.points)
              : createLinearPath(dataset.points)

          return (
            <Path
              key={`line-${dataset.id}`}
              d={linePath}
              stroke={dataset.color}
              strokeWidth={strokeWidth}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )
        })}

        {/* Dots */}
        {showDots &&
          chartData.datasetPoints.map((dataset) =>
            dataset.points.map((point, index) => (
              <Circle
                key={`dot-${dataset.id}-${index}`}
                cx={point.x}
                cy={point.y}
                r={4}
                fill={theme.colors.card}
                stroke={dataset.color}
                strokeWidth={2}
              />
            )),
          )}

        {/* Values */}
        {showValues &&
          chartData.datasetPoints.map((dataset) =>
            dataset.points.map((point, index) => (
              <SvgText
                key={`value-${dataset.id}-${index}`}
                x={point.x}
                y={point.y - 12}
                fontSize={10}
                fill={theme.colors.foreground}
                textAnchor="middle"
                fontWeight="600"
              >
                {point.value}
              </SvgText>
            )),
          )}
      </Svg>

      {/* Legend */}
      {showLegend && (
        <View style={styles.legend}>
          {chartData.datasetPoints.map((dataset) => (
            <View key={`legend-${dataset.id}`} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: dataset.color }]} />
              <Text text={dataset.label} size="xs" style={styles.legendText} />
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
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: theme.spacing.sm,
    gap: theme.spacing.md,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: theme.colors.foregroundSecondary,
  },
}))
