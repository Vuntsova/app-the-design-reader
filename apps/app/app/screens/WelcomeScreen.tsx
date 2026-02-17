import { FC } from "react"
import { View, TouchableOpacity, Alert } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { StyleSheet, useUnistyles } from "react-native-unistyles"

import { Divider } from "@/components/Divider"
import { AuthScreenLayout } from "@/components/layouts/AuthScreenLayout"
import { Text } from "@/components/Text"
import { features } from "@/config/features"
import { useAuth } from "@/hooks"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"

// =============================================================================
// TYPES
// =============================================================================

interface WelcomeScreenProps extends AppStackScreenProps<"Welcome"> {}

// =============================================================================
// COMPONENT
// =============================================================================

export const WelcomeScreen: FC<WelcomeScreenProps> = function WelcomeScreen(_props) {
  const { navigation } = _props
  const { theme } = useUnistyles()
  const { signInWithGoogle, signInWithApple, isLoading } = useAuth()

  const handleGoToLogin = () => {
    navigation.navigate("Login" as never)
  }

  const handleGoToRegister = () => {
    navigation.navigate("Register" as never)
  }

  const handleAppleAuth = async () => {
    try {
      const { error } = await signInWithApple()
      if (error) {
        Alert.alert("Sign In Error", error.message)
      }
    } catch {
      Alert.alert("Sign In Error", "Failed to sign in with Apple")
    }
  }

  const handleGoogleAuth = async () => {
    try {
      const { error } = await signInWithGoogle()
      if (error) {
        Alert.alert("Sign In Error", error.message)
      }
    } catch {
      Alert.alert("Sign In Error", "Failed to sign in with Google")
    }
  }

  return (
    <AuthScreenLayout
      title="Get Started"
      subtitle="Create an account or sign in to access all features."
      scrollable={false}
      centerContent
    >
      {/* Primary Button - Register */}
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={handleGoToRegister}
        activeOpacity={0.8}
        disabled={isLoading}
      >
        <Text weight="semiBold" style={styles.primaryButtonText}>
          Create Account
        </Text>
      </TouchableOpacity>

      {/* Secondary Button - Login */}
      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={handleGoToLogin}
        activeOpacity={0.8}
        disabled={isLoading}
      >
        <Text weight="semiBold" style={styles.secondaryButtonText}>
          Sign In
        </Text>
      </TouchableOpacity>

      {/* Social Login Section - Only show if at least one social auth is enabled */}
      {(features.enableGoogleAuth || features.enableAppleAuth) && (
        <>
          <Divider label="or continue with" style={styles.divider} />

          {/* Social Buttons Row */}
          <View style={styles.socialRow}>
            {features.enableAppleAuth && (
              <TouchableOpacity
                style={styles.socialButton}
                onPress={handleAppleAuth}
                activeOpacity={0.8}
                disabled={isLoading}
              >
                <Ionicons name="logo-apple" size={24} color={theme.colors.foreground} />
                <Text weight="semiBold">Apple</Text>
              </TouchableOpacity>
            )}

            {features.enableGoogleAuth && (
              <TouchableOpacity
                style={styles.socialButton}
                onPress={handleGoogleAuth}
                activeOpacity={0.8}
                disabled={isLoading}
              >
                <Ionicons name="logo-google" size={24} color={theme.colors.foreground} />
                <Text weight="semiBold">Google</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}
    </AuthScreenLayout>
  )
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create((theme) => ({
  primaryButton: {
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    ...theme.shadows.md,
  },
  primaryButtonText: {
    color: theme.colors.primaryForeground,
    fontSize: theme.typography.sizes.lg,
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: theme.colors.secondary,
    borderRadius: theme.radius.lg,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
  },
  secondaryButtonText: {
    color: theme.colors.secondaryForeground,
    fontSize: theme.typography.sizes.lg,
  },
  divider: {
    marginVertical: theme.spacing.lg,
  },
  socialRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  socialButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.secondary,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.lg,
    gap: theme.spacing.xs,
  },
}))
