import { useEffect } from "react"
import type { ViewStyle } from "react-native"
import { View } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import Animated, {
  useAnimatedStyle,
  useAnimatedProps,
  useSharedValue,
  withSpring,
  withTiming,
  withRepeat,
  cancelAnimation,
  interpolate,
  Easing,
} from "react-native-reanimated"
import Svg, { Circle } from "react-native-svg"
import { StyleSheet, useUnistyles } from "react-native-unistyles"

import { SPRING_CONFIG_PROGRESS } from "@/utils/animations"

import { Text } from "./Text"

// Create animated circle component
const AnimatedCircle = Animated.createAnimatedComponent(Circle)

// =============================================================================
// TYPES
// =============================================================================

type Variants = "default" | "success" | "warning" | "error" | "gradient"
type Sizes = "sm" | "md" | "lg"
type Types = "linear" | "circular"

export interface ProgressProps {
  /**
   * Progress value (0-100). Optional when indeterminate is true.
   */
  value?: number
  /**
   * Progress variant/color
   */
  variant?: Variants
  /**
   * Progress size
   */
  size?: Sizes
  /**
   * Progress type: linear bar or circular ring
   */
  type?: Types
  /**
   * Show animated stripes (linear only)
   */
  animated?: boolean
  /**
   * Show indeterminate loading animation
   */
  indeterminate?: boolean
  /**
   * Show percentage text inside (circular only)
   */
  showValue?: boolean
  /**
   * Stroke width for circular progress
   */
  strokeWidth?: number
  /**
   * Additional container style
   */
  style?: ViewStyle
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Progress component with linear bar or circular ring variants.
 *
 * @example
 * // Basic progress bar
 * <Progress value={75} />
 *
 * // Circular progress
 * <Progress type="circular" value={75} />
 * <Progress type="circular" value={75} showValue />
 *
 * // Animated stripes
 * <Progress value={60} animated />
 *
 * // Variants
 * <Progress value={100} variant="success" />
 * <Progress value={50} variant="warning" />
 *
 * // Sizes
 * <Progress value={60} size="sm" />
 * <Progress value={60} size="lg" />
 *
 * // Indeterminate (loading)
 * <Progress indeterminate />
 * <Progress type="circular" indeterminate />
 */
export function Progress(props: ProgressProps) {
  const {
    value,
    variant = "default",
    size = "md",
    type = "linear",
    animated = false,
    indeterminate = false,
    showValue = false,
    strokeWidth: customStrokeWidth,
    style,
  } = props

  const { theme } = useUnistyles()

  // Circular progress dimensions based on size
  const circularSizes = {
    sm: { size: 32, strokeWidth: 3, fontSize: 10 },
    md: { size: 48, strokeWidth: 4, fontSize: 12 },
    lg: { size: 64, strokeWidth: 5, fontSize: 14 },
  }

  const circularConfig = circularSizes[size]
  const circleSize = circularConfig.size
  const strokeWidth = customStrokeWidth ?? circularConfig.strokeWidth
  const radius = (circleSize - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI

  // Animation values
  const progressWidth = useSharedValue(0)
  const indeterminatePosition = useSharedValue(0)
  const stripesPosition = useSharedValue(0)
  const circularProgress = useSharedValue(0)
  const circularRotation = useSharedValue(0)

  // Apply variants
  styles.useVariants({ size })

  // Stripes animation
  useEffect(() => {
    if (animated && !indeterminate && type === "linear") {
      stripesPosition.value = withRepeat(
        withTiming(1, {
          duration: 1000,
          easing: Easing.linear,
        }),
        -1,
        false,
      )
    }
  }, [animated, indeterminate, stripesPosition, type])

  // Linear progress animation
  useEffect(() => {
    if (!indeterminate && value !== undefined && type === "linear") {
      progressWidth.value = withSpring(Math.min(Math.max(value, 0), 100), SPRING_CONFIG_PROGRESS)
    }
  }, [value, indeterminate, progressWidth, type])

  // Circular progress animation
  useEffect(() => {
    if (type === "circular" && !indeterminate && value !== undefined) {
      const clampedValue = Math.min(Math.max(value, 0), 100)
      circularProgress.value = withSpring(clampedValue / 100, SPRING_CONFIG_PROGRESS)
    }
  }, [value, indeterminate, circularProgress, type])

  // Circular indeterminate rotation
  useEffect(() => {
    if (type === "circular" && indeterminate) {
      circularRotation.value = withRepeat(
        withTiming(360, {
          duration: 1000,
          easing: Easing.linear,
        }),
        -1,
        false,
      )
    }
  }, [indeterminate, circularRotation, type])

  // Indeterminate animation
  useEffect(() => {
    if (indeterminate) {
      indeterminatePosition.value = withRepeat(
        withTiming(1, {
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        false,
      )
      return () => {
        cancelAnimation(indeterminatePosition)
      }
    }
    return undefined
  }, [indeterminate, indeterminatePosition])

  // Get variant color
  const getProgressColor = () => {
    switch (variant) {
      case "success":
        return theme.colors.success
      case "warning":
        return theme.colors.warning
      case "error":
        return theme.colors.error
      case "gradient":
        return theme.colors.palette.primary500
      default:
        return theme.colors.primary
    }
  }

  // Animated styles
  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%` as unknown as number,
  }))

  const indeterminateStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(indeterminatePosition.value, [0, 1], [-100, 300]),
      },
    ],
  }))

  // Animated stripes style - moves diagonally
  const stripesAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(stripesPosition.value, [0, 1], [0, 20]),
      },
    ],
  }))

  // Circular progress stroke animation (using animatedProps for SVG)
  const circularStrokeProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - circularProgress.value),
  }))

  // Circular indeterminate rotation
  const circularRotationStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${circularRotation.value}deg` }],
  }))

  // Render circular progress
  if (type === "circular") {
    const progressColor = getProgressColor()
    const displayValue = Math.round(Math.min(Math.max(value ?? 0, 0), 100))

    return (
      <View style={[styles.circularContainer, { width: circleSize, height: circleSize }, style]}>
        <Animated.View style={indeterminate ? circularRotationStyle : undefined}>
          <Svg width={circleSize} height={circleSize} style={{ transform: [{ rotate: "-90deg" }] }}>
            {/* Background circle */}
            <Circle
              cx={circleSize / 2}
              cy={circleSize / 2}
              r={radius}
              stroke={theme.colors.backgroundSecondary}
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            {/* Progress circle */}
            <AnimatedCircle
              cx={circleSize / 2}
              cy={circleSize / 2}
              r={radius}
              stroke={progressColor}
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeLinecap="round"
              animatedProps={circularStrokeProps}
            />
          </Svg>
        </Animated.View>

        {/* Percentage text */}
        {showValue && !indeterminate && (
          <View style={styles.circularValueContainer}>
            <Text style={[styles.circularValue, { fontSize: circularConfig.fontSize }]}>
              {displayValue}%
            </Text>
          </View>
        )}
      </View>
    )
  }

  // Render linear progress
  return (
    <View style={[styles.container, style]}>
      {indeterminate ? (
        <Animated.View
          style={[
            styles.progress,
            styles.indeterminate,
            { backgroundColor: getProgressColor() },
            indeterminateStyle,
          ]}
        />
      ) : (
        <Animated.View
          style={[styles.progress, { backgroundColor: getProgressColor() }, progressStyle]}
        >
          {animated && (
            <Animated.View style={[styles.stripesContainer, stripesAnimatedStyle]}>
              <LinearGradient
                colors={[
                  "transparent",
                  "rgba(255,255,255,0.2)",
                  "transparent",
                  "rgba(255,255,255,0.2)",
                  "transparent",
                  "rgba(255,255,255,0.2)",
                  "transparent",
                  "rgba(255,255,255,0.2)",
                  "transparent",
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.stripesGradient}
              />
            </Animated.View>
          )}
        </Animated.View>
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
    backgroundColor: theme.colors.backgroundTertiary,
    borderRadius: theme.radius.full,
    overflow: "hidden",
    variants: {
      size: {
        sm: {
          height: 6,
        },
        md: {
          height: 10,
        },
        lg: {
          height: 14,
        },
      },
    },
  },
  progress: {
    height: "100%",
    borderRadius: theme.radius.full,
  },
  indeterminate: {
    width: "35%",
    position: "absolute",
  },
  stripesContainer: {
    position: "absolute",
    top: 0,
    left: -20,
    right: 0,
    bottom: 0,
    width: "200%",
    overflow: "hidden",
  },
  stripesGradient: {
    flex: 1,
    width: "100%",
  },
  circularContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  circularValueContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  circularValue: {
    fontFamily: theme.typography.fonts.bold,
    color: theme.colors.foreground,
    letterSpacing: -0.5,
  },
}))
