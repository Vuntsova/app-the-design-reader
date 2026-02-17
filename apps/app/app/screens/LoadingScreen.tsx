import { useEffect, useRef } from "react"
/* eslint-disable no-restricted-imports -- LoadingScreen renders before i18n init, must use RN Text directly */
import { View, Animated, Easing, Platform, useWindowDimensions, Text as RNText } from "react-native"
/* eslint-enable no-restricted-imports */
import { LinearGradient } from "expo-linear-gradient"
import { StyleSheet, useUnistyles } from "react-native-unistyles"

import { ANIMATION } from "@/config/constants"
import { webDimension } from "@/types/webStyles"

// =============================================================================
// TYPES
// =============================================================================

export interface LoadingScreenProps {
  /**
   * Optional loading message
   */
  message?: string
  /**
   * Optional detailed status
   */
  status?: string
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Full-screen loading screen with animated spinner and gradient background.
 *
 * @example
 * // Basic loading screen
 * <LoadingScreen />
 *
 * // With message
 * <LoadingScreen message="Initializing app..." />
 *
 * // With message and status
 * <LoadingScreen message="Loading" status="Preparing your experience..." />
 */
export function LoadingScreen(props: LoadingScreenProps) {
  const { message = "Loading", status } = props
  const { theme } = useUnistyles()
  const { height: windowHeight } = useWindowDimensions()

  // Ensure we cover the full viewport on web while we wait for app boot.
  const webViewportStyle =
    Platform.OS === "web"
      ? {
          minHeight: windowHeight,
          height: windowHeight,
          width: webDimension("100%"),
        }
      : undefined

  // Animation for pulsing effect
  const pulseAnim = useRef(new Animated.Value(1)).current
  const rotateAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    // Pulsing animation
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== "web", // Native driver not supported on web
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== "web", // Native driver not supported on web
        }),
      ]),
    )
    pulseLoop.start()

    // Rotation animation
    const rotateLoop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== "web", // Native driver not supported on web
      }),
    )
    rotateLoop.start()

    return () => {
      pulseLoop.stop()
      rotateLoop.stop()
      pulseAnim.stopAnimation()
      rotateAnim.stopAnimation()
    }
  }, [pulseAnim, rotateAnim])

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  })

  return (
    <View style={[styles.container, webViewportStyle]}>
      <LinearGradient
        colors={[theme.colors.gradientStart, theme.colors.gradientMiddle, theme.colors.gradientEnd]}
        style={[styles.gradient, webViewportStyle]}
      >
        <View style={styles.content}>
          {/* Animated Spinner Container */}
          <View style={styles.spinnerContainer}>
            {/* Outer ring */}
            <Animated.View
              style={[
                styles.outerRing,
                {
                  transform: [{ rotate }],
                  borderColor: theme.colors.primary,
                },
              ]}
            />
            {/* Middle ring */}
            <Animated.View
              style={[
                styles.middleRing,
                {
                  transform: [{ rotate }, { scale: pulseAnim }],
                  borderColor: theme.colors.accent,
                },
              ]}
            />
            {/* Inner dot */}
            <Animated.View
              style={[
                styles.innerDot,
                {
                  transform: [{ scale: pulseAnim }],
                  backgroundColor: theme.colors.primary,
                },
              ]}
            />
          </View>

          {/* Loading Text - Using RNText directly since this screen renders before i18n init */}
          <View style={styles.textContainer}>
            <RNText style={[styles.loadingText, { color: theme.colors.foreground }]}>
              {message}
            </RNText>
            {status && (
              <RNText style={[styles.statusText, { color: theme.colors.foregroundSecondary }]}>
                {status}
              </RNText>
            )}
          </View>

          {/* Loading dots animation */}
          <View style={styles.dotsContainer}>
            <LoadingDot delay={0} />
            <LoadingDot delay={ANIMATION.STAGGER_DELAY * 2} />
            <LoadingDot delay={ANIMATION.STAGGER_DELAY * 4} />
          </View>
        </View>
      </LinearGradient>
    </View>
  )
}

// =============================================================================
// LOADING DOT COMPONENT
// =============================================================================

function LoadingDot({ delay }: { delay: number }) {
  const { theme } = useUnistyles()
  const opacity = useRef(new Animated.Value(0.3)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== "web", // Native driver not supported on web
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== "web", // Native driver not supported on web
        }),
      ]),
    )

    const timer = setTimeout(() => {
      loop.start()
    }, delay)

    return () => {
      clearTimeout(timer)
      loop.stop()
      opacity.stopAnimation()
    }
  }, [delay, opacity])

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          opacity,
          backgroundColor: theme.colors.foregroundSecondary,
        },
      ]}
    />
  )
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.lg,
  },
  spinnerContainer: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.xl,
  },
  outerRing: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderTopColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "transparent",
  },
  middleRing: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderTopColor: "transparent",
    borderLeftColor: "transparent",
    borderBottomColor: "transparent",
  },
  innerDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  textContainer: {
    alignItems: "center",
    marginBottom: theme.spacing.lg,
  },
  loadingText: {
    marginBottom: theme.spacing.xs,
    textAlign: "center",
    fontSize: theme.typography.sizes["2xl"],
    lineHeight: theme.typography.lineHeights["2xl"],
    fontFamily: theme.typography.fonts.bold,
  },
  statusText: {
    textAlign: "center",
    fontSize: theme.typography.sizes.base,
    lineHeight: theme.typography.lineHeights.base,
    fontFamily: theme.typography.fonts.regular,
  },
  dotsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
}))
