import { useEffect, useMemo, useState } from "react"
import type { ImageProps, ViewStyle } from "react-native"
import { Image, View } from "react-native"
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  interpolate,
  Easing,
  cancelAnimation,
} from "react-native-reanimated"
import { StyleSheet, useUnistyles } from "react-native-unistyles"

import { Text } from "./Text"

// =============================================================================
// TYPES
// =============================================================================

type Sizes = "xs" | "sm" | "md" | "lg" | "xl"
type Shapes = "circle" | "rounded" | "square"
type Status = "online" | "offline" | "busy" | "away"

export interface AvatarProps {
  /**
   * Image source (uri or require)
   */
  source?: ImageProps["source"]
  /**
   * Fallback text (initials) when no image
   */
  fallback?: string
  /**
   * Avatar size
   */
  size?: Sizes
  /**
   * Avatar shape
   */
  shape?: Shapes
  /**
   * Alt text for accessibility
   */
  alt?: string
  /**
   * Show loading skeleton while image loads
   */
  loading?: boolean
  /**
   * Online/offline status indicator
   */
  status?: Status
  /**
   * Show border around avatar
   */
  showBorder?: boolean
  /**
   * Callback when image fails to load
   */
  onLoadError?: () => void
  /**
   * Callback when image loads successfully
   */
  onLoadSuccess?: () => void
  /**
   * Additional style
   */
  style?: ViewStyle
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Avatar component for displaying user profile images or initials.
 *
 * @example
 * // With image
 * <Avatar source={{ uri: "https://..." }} size="lg" />
 *
 * // With fallback initials
 * <Avatar fallback="JD" />
 *
 * // With loading state
 * <Avatar source={{ uri: "https://..." }} loading />
 *
 * // With status indicator
 * <Avatar fallback="JD" status="online" />
 *
 * // Different shapes
 * <Avatar fallback="AB" shape="rounded" />
 * <Avatar fallback="CD" shape="square" />
 */
export function Avatar(props: AvatarProps) {
  const {
    source,
    fallback,
    size = "md",
    shape = "circle",
    alt,
    loading: externalLoading,
    status,
    showBorder = false,
    onLoadError,
    onLoadSuccess,
    style,
  } = props

  const { theme } = useUnistyles()
  const [isLoading, setIsLoading] = useState(!!source)
  const [hasError, setHasError] = useState(false)

  // Apply variants
  styles.useVariants({ size, shape })

  // Shimmer animation for loading state
  const shimmer = useSharedValue(0)

  useEffect(() => {
    if (isLoading || externalLoading) {
      shimmer.value = withRepeat(
        withTiming(1, {
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        false,
      )
      return () => {
        cancelAnimation(shimmer)
      }
    }

    cancelAnimation(shimmer)
    shimmer.value = 0

    return () => {
      cancelAnimation(shimmer)
    }
  }, [externalLoading, isLoading, shimmer])

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 0.5, 1], [0.3, 0.6, 0.3]),
  }))

  const initials = useMemo(() => {
    if (!fallback) return ""
    return fallback
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }, [fallback])

  const hasImage =
    source &&
    !hasError &&
    (typeof source === "number" ||
      (typeof source === "object" && !Array.isArray(source) && source.uri))

  const handleLoadStart = () => {
    setIsLoading(true)
  }

  const handleLoadEnd = () => {
    setIsLoading(false)
    onLoadSuccess?.()
  }

  const handleError = () => {
    setIsLoading(false)
    setHasError(true)
    onLoadError?.()
  }

  // Get status indicator color
  const getStatusColor = () => {
    switch (status) {
      case "online":
        return theme.colors.success
      case "offline":
        return theme.colors.foregroundTertiary
      case "busy":
        return theme.colors.error
      case "away":
        return theme.colors.warning
      default:
        return undefined
    }
  }

  const statusColor = getStatusColor()

  // Loading skeleton
  if (externalLoading) {
    return (
      <Animated.View
        style={[styles.skeleton, showBorder && styles.border, shimmerStyle, style]}
        accessibilityLabel="Loading avatar"
      />
    )
  }

  // Render image with loading state
  if (hasImage) {
    return (
      <View style={[styles.container, style]}>
        {/* Show skeleton while loading */}
        {isLoading && (
          <Animated.View style={[styles.skeleton, styles.skeletonAbsolute, shimmerStyle]} />
        )}

        <Image
          source={source}
          style={[styles.image, showBorder && styles.border, isLoading && styles.imageHidden]}
          accessibilityLabel={alt || "Avatar"}
          onLoadStart={handleLoadStart}
          onLoadEnd={handleLoadEnd}
          onError={handleError}
        />

        {/* Status indicator */}
        {status && statusColor && (
          <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />
        )}
      </View>
    )
  }

  // Fallback with initials
  return (
    <View style={[styles.container, style]}>
      <View
        style={[styles.fallback, showBorder && styles.border]}
        accessibilityLabel={alt || fallback || "Avatar"}
      >
        <Text style={styles.initials}>{initials}</Text>
      </View>

      {/* Status indicator */}
      {status && statusColor && (
        <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />
      )}
    </View>
  )
}

// =============================================================================
// AVATAR GROUP
// =============================================================================

export interface AvatarGroupProps {
  /**
   * Array of avatar props
   */
  avatars: AvatarProps[]
  /**
   * Maximum avatars to show
   */
  max?: number
  /**
   * Avatar size
   */
  size?: Sizes
  /**
   * Additional style
   */
  style?: ViewStyle
}

/**
 * Display a group of overlapping avatars.
 *
 * @example
 * <AvatarGroup
 *   avatars={[
 *     { source: { uri: "..." } },
 *     { fallback: "JD" },
 *     { fallback: "AB" },
 *   ]}
 *   max={3}
 * />
 */
export function AvatarGroup(props: AvatarGroupProps) {
  const { avatars, max = 4, size = "md", style } = props

  const visibleAvatars = avatars.slice(0, max)
  const remainingCount = avatars.length - max

  // Apply variants for group
  styles.useVariants({ size, shape: "circle" })

  return (
    <View style={[styles.group, style]}>
      {visibleAvatars.map((avatar, index) => (
        <View key={index} style={[styles.groupItem, { zIndex: visibleAvatars.length - index }]}>
          <Avatar {...avatar} size={size} showBorder />
        </View>
      ))}

      {remainingCount > 0 && (
        <View style={[styles.groupItem, styles.remainingCount]}>
          <View style={styles.fallback}>
            <Text style={styles.initials}>+{remainingCount}</Text>
          </View>
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
    position: "relative",
  },
  image: {
    variants: {
      size: {
        xs: {
          width: theme.sizes.avatar.xs,
          height: theme.sizes.avatar.xs,
        },
        sm: {
          width: theme.sizes.avatar.sm,
          height: theme.sizes.avatar.sm,
        },
        md: {
          width: theme.sizes.avatar.md,
          height: theme.sizes.avatar.md,
        },
        lg: {
          width: theme.sizes.avatar.lg,
          height: theme.sizes.avatar.lg,
        },
        xl: {
          width: theme.sizes.avatar.xl,
          height: theme.sizes.avatar.xl,
        },
      },
      shape: {
        circle: {
          borderRadius: theme.radius.full,
        },
        rounded: {
          borderRadius: theme.radius.lg,
        },
        square: {
          borderRadius: theme.radius.sm,
        },
      },
    },
  },
  imageHidden: {
    opacity: 0,
  },
  skeleton: {
    backgroundColor: theme.colors.backgroundSecondary,
    variants: {
      size: {
        xs: {
          width: theme.sizes.avatar.xs,
          height: theme.sizes.avatar.xs,
        },
        sm: {
          width: theme.sizes.avatar.sm,
          height: theme.sizes.avatar.sm,
        },
        md: {
          width: theme.sizes.avatar.md,
          height: theme.sizes.avatar.md,
        },
        lg: {
          width: theme.sizes.avatar.lg,
          height: theme.sizes.avatar.lg,
        },
        xl: {
          width: theme.sizes.avatar.xl,
          height: theme.sizes.avatar.xl,
        },
      },
      shape: {
        circle: {
          borderRadius: theme.radius.full,
        },
        rounded: {
          borderRadius: theme.radius.lg,
        },
        square: {
          borderRadius: theme.radius.sm,
        },
      },
    },
  },
  skeletonAbsolute: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 1,
  },
  fallback: {
    backgroundColor: theme.colors.backgroundTertiary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    variants: {
      size: {
        xs: {
          width: theme.sizes.avatar.xs,
          height: theme.sizes.avatar.xs,
        },
        sm: {
          width: theme.sizes.avatar.sm,
          height: theme.sizes.avatar.sm,
        },
        md: {
          width: theme.sizes.avatar.md,
          height: theme.sizes.avatar.md,
        },
        lg: {
          width: theme.sizes.avatar.lg,
          height: theme.sizes.avatar.lg,
        },
        xl: {
          width: theme.sizes.avatar.xl,
          height: theme.sizes.avatar.xl,
        },
      },
      shape: {
        circle: {
          borderRadius: theme.radius.full,
        },
        rounded: {
          borderRadius: theme.radius.xl,
        },
        square: {
          borderRadius: theme.radius.md,
        },
      },
    },
  },
  border: {
    borderWidth: 2.5,
    borderColor: theme.colors.card,
  },
  initials: {
    color: theme.colors.foregroundSecondary,
    fontFamily: theme.typography.fonts.bold,
    letterSpacing: 0.5,
    variants: {
      size: {
        xs: {
          fontSize: 9,
          lineHeight: 11,
        },
        sm: {
          fontSize: theme.typography.sizes.xs,
          lineHeight: theme.typography.sizes.xs * 1.2,
        },
        md: {
          fontSize: theme.typography.sizes.sm,
          lineHeight: theme.typography.sizes.sm * 1.2,
        },
        lg: {
          fontSize: theme.typography.sizes.lg,
          lineHeight: theme.typography.sizes.lg * 1.2,
        },
        xl: {
          fontSize: theme.typography.sizes.xl,
          lineHeight: theme.typography.sizes.xl * 1.2,
        },
      },
      shape: {
        circle: {},
        rounded: {},
        square: {},
      },
    },
  },
  statusIndicator: {
    position: "absolute",
    bottom: 0,
    right: 0,
    borderWidth: 2,
    borderColor: theme.colors.background,
    borderRadius: theme.radius.full,
    variants: {
      size: {
        xs: {
          width: 8,
          height: 8,
        },
        sm: {
          width: 10,
          height: 10,
        },
        md: {
          width: 12,
          height: 12,
        },
        lg: {
          width: 14,
          height: 14,
        },
        xl: {
          width: 16,
          height: 16,
        },
      },
      shape: {
        circle: {},
        rounded: {},
        square: {},
      },
    },
  },
  group: {
    flexDirection: "row",
    alignItems: "center",
  },
  groupItem: {
    marginLeft: -8,
  },
  remainingCount: {
    marginLeft: -8,
  },
}))
