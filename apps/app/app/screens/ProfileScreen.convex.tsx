/**
 * ProfileScreen - Convex Version
 *
 * This screen demonstrates proper data fetching patterns with Convex:
 * - Reactive queries that auto-update when data changes
 * - Type-safe mutations with automatic query invalidation
 * - No manual refetching needed - data updates in real-time!
 *
 * KEY DIFFERENCE FROM SUPABASE:
 * - No React Query needed - Convex handles caching and updates
 * - No pull-to-refresh needed - queries are reactive
 * - Data syncs across all clients automatically
 *
 * Copy this pattern for your own profile/settings screens with Convex.
 */

import { FC, useState } from "react"
import { ScrollView, Switch, Pressable, View, Platform, useWindowDimensions } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { api } from "@convex/_generated/api"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import Animated, { FadeInDown } from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { StyleSheet, useUnistyles } from "react-native-unistyles"
import { UnistylesRuntime } from "react-native-unistyles"

import { Avatar, Button, DeleteAccountModal, Text, LanguageSelector, MenuItem } from "@/components"
import { ANIMATION } from "@/config/constants"
import { features } from "@/config/features"
import { useAuth } from "@/hooks"
import { useQuery, useMutation } from "@/hooks/convex"
import type { MainTabScreenProps } from "@/navigators/navigationTypes"
import { mockRevenueCat } from "@/services/mocks/revenueCat"
import { isRevenueCatMock } from "@/services/revenuecat"
import { useNotificationStore, useSubscriptionStore, useWidgetStore } from "@/stores"
import { webDimension } from "@/types/webStyles"
import { haptics } from "@/utils/haptics"
import { testErrors } from "@/utils/testError"

import { EditProfileModalConvex } from "../components/EditProfileModal.convex"

// =============================================================================
// CONSTANTS
// =============================================================================

const isWeb = Platform.OS === "web"
const CONTENT_MAX_WIDTH = 600

// =============================================================================
// TYPES
// =============================================================================

interface ProfileScreenProps extends MainTabScreenProps<"Profile"> {}

// =============================================================================
// COMPONENT
// =============================================================================

export const ProfileScreen: FC<ProfileScreenProps> = ({ navigation }) => {
  const { t } = useTranslation()
  const { user, signOut, userId } = useAuth()
  const isPro = useSubscriptionStore((state) => state.isPro)
  const checkProStatus = useSubscriptionStore((state) => state.checkProStatus)
  const isPushEnabled = useNotificationStore((state) => state.isPushEnabled)
  const togglePush = useNotificationStore((state) => state.togglePush)
  const isWidgetsEnabled = useWidgetStore((state) => state.isWidgetsEnabled)
  const userWidgetsEnabled = useWidgetStore((state) => state.userWidgetsEnabled)
  const toggleWidgets = useWidgetStore((state) => state.toggleWidgets)
  const syncStatus = useWidgetStore((state) => state.syncStatus)
  const insets = useSafeAreaInsets()
  const { theme } = useUnistyles()
  const { width: windowWidth } = useWindowDimensions()

  const [editModalVisible, setEditModalVisible] = useState(false)
  const [deleteModalVisible, setDeleteModalVisible] = useState(false)
  const [languageModalVisible, setLanguageModalVisible] = useState(false)

  // ============================================================
  // CONVEX DATA FETCHING
  // These queries are REACTIVE - they auto-update when data changes!
  // No manual refetching or invalidation needed.
  // ============================================================

  // Reactive query - auto-updates when user data changes
  const convexUser = useQuery(api.users.me)

  // Mutations - auto-invalidate related queries
  const updateProfileMutation = useMutation(api.users.updateProfile)

  // Loading state: undefined means loading (used by convexUser check)
  const _isLoading = convexUser === undefined

  const isLargeScreen = windowWidth > 768
  const contentStyle = isLargeScreen
    ? {
        maxWidth: CONTENT_MAX_WIDTH,
        alignSelf: "center" as const,
        width: webDimension("100%"),
      }
    : {}

  // Derive display name from Convex user (reactive!)
  const displayName = convexUser?.name || user?.email?.split("@")[0] || "User"
  const userInitials = displayName.slice(0, 2).toUpperCase()
  const avatarUrl = convexUser?.avatarUrl ?? convexUser?.image ?? undefined

  const toggleThemeMode = () => {
    haptics.switchChange()
    const newTheme = UnistylesRuntime.themeName === "dark" ? "light" : "dark"
    UnistylesRuntime.setTheme(newTheme)
  }

  const handleTogglePush = () => {
    haptics.switchChange()
    togglePush(userId ?? undefined)
  }

  const handleToggleWidgets = () => {
    haptics.switchChange()
    toggleWidgets()
  }

  const handleSignOut = async () => {
    haptics.buttonPress()
    await signOut()
  }

  const handleMockToggleSubscription = () => {
    haptics.switchChange()
    mockRevenueCat.setProStatus(!isPro)
    checkProStatus()
  }

  const handleProfileUpdate = async (name: string, bio?: string) => {
    try {
      await updateProfileMutation({ name, bio })
      // No need to refetch! The useQuery hook auto-updates
      return { error: null }
    } catch (error) {
      return { error: error as Error }
    }
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[theme.colors.gradientStart, theme.colors.gradientMiddle, theme.colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            contentStyle,
            { paddingTop: insets.top + theme.spacing.lg },
          ]}
          showsVerticalScrollIndicator={false}
          // No RefreshControl needed! Data is reactive
        >
          {/* Header */}
          <Animated.View entering={FadeInDown.delay(0).springify()} style={styles.header}>
            <Text style={styles.screenTitle} tx="profileScreen:title" />
            <View style={styles.headerBadges}>
              <Text preset="caption" style={styles.backendBadge}>
                Convex (Reactive)
              </Text>
              <Ionicons name="flash" size={14} color={theme.colors.primary} />
            </View>
          </Animated.View>

          {/* Profile Card */}
          <Animated.View
            entering={FadeInDown.delay(ANIMATION.STAGGER_DELAY).springify()}
            style={styles.profileCard}
          >
            <View style={styles.profileCardInner}>
              <Avatar
                source={avatarUrl ? { uri: avatarUrl } : undefined}
                fallback={userInitials}
                size="xl"
              />
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{displayName}</Text>
                <Text style={styles.profileEmail}>{user?.email}</Text>
                {convexUser?.bio && (
                  <Text style={styles.profileBio} numberOfLines={2}>
                    {convexUser.bio}
                  </Text>
                )}
                {isPro ? (
                  <View style={styles.proBadge}>
                    <Ionicons name="diamond" size={12} color={theme.colors.background} />
                    <Text style={styles.proText} tx="profileScreen:proBadge" />
                    {isRevenueCatMock && <Text style={styles.mockBadge}> (Mock)</Text>}
                  </View>
                ) : (
                  <Pressable
                    style={styles.upgradeButton}
                    onPress={() => {
                      haptics.buttonPress()
                      navigation.navigate("Paywall")
                    }}
                  >
                    <Text style={styles.upgradeText} tx="profileScreen:upgradeButton" />
                  </Pressable>
                )}
              </View>
            </View>
          </Animated.View>

          {/* Reactivity Info Card */}
          <Animated.View
            entering={FadeInDown.delay(ANIMATION.STAGGER_DELAY * 1.5).springify()}
            style={styles.infoCard}
          >
            <View style={styles.infoRow}>
              <Ionicons name="sync" size={20} color={theme.colors.primary} />
              <Text preset="caption" style={styles.infoText}>
                Profile data syncs in real-time across all your devices!
              </Text>
            </View>
          </Animated.View>

          {/* Settings Section */}
          <Animated.View entering={FadeInDown.delay(ANIMATION.STAGGER_DELAY * 2).springify()}>
            <Text style={styles.sectionTitle} tx="profileScreen:settingsTitle" />
          </Animated.View>
          <Animated.View
            entering={FadeInDown.delay(ANIMATION.STAGGER_DELAY * 2.5).springify()}
            style={styles.menuGroup}
          >
            <MenuItem
              icon="person-outline"
              title={t("profileScreen:personalInfo")}
              subtitle={t("profileScreen:personalInfoSubtitle")}
              onPress={() => setEditModalVisible(true)}
            />
            <View style={styles.divider} />
            <MenuItem
              icon="notifications-outline"
              title={t("profileScreen:notifications")}
              subtitle={t("profileScreen:notificationsSubtitle")}
              rightElement={
                <Switch
                  value={isPushEnabled}
                  onValueChange={handleTogglePush}
                  trackColor={{ false: theme.colors.borderSecondary, true: theme.colors.primary }}
                  thumbColor={theme.colors.card}
                />
              }
            />
            <View style={styles.divider} />
            <MenuItem
              icon="moon-outline"
              title={t("profileScreen:darkMode")}
              rightElement={
                <Switch
                  value={UnistylesRuntime.themeName === "dark"}
                  onValueChange={toggleThemeMode}
                  trackColor={{ false: theme.colors.borderSecondary, true: theme.colors.primary }}
                  thumbColor={theme.colors.card}
                />
              }
            />
            <View style={styles.divider} />
            <MenuItem
              icon="language-outline"
              title={t("settings:language")}
              subtitle={t("profileScreen:languageSubtitle")}
              onPress={() => setLanguageModalVisible(true)}
            />
            {isWidgetsEnabled && (
              <>
                <View style={styles.divider} />
                <MenuItem
                  icon="apps-outline"
                  title={t("profileScreen:widgets")}
                  subtitle={
                    syncStatus === "syncing"
                      ? t("profileScreen:widgetsSyncing")
                      : userWidgetsEnabled
                        ? t("profileScreen:widgetsEnabled")
                        : t("profileScreen:widgetsDisabled")
                  }
                  rightElement={
                    <Switch
                      value={userWidgetsEnabled}
                      onValueChange={handleToggleWidgets}
                      trackColor={{
                        false: theme.colors.borderSecondary,
                        true: theme.colors.primary,
                      }}
                      thumbColor={theme.colors.card}
                      disabled={syncStatus === "syncing"}
                    />
                  }
                />
              </>
            )}
          </Animated.View>

          {/* Support Section */}
          <Animated.View entering={FadeInDown.delay(ANIMATION.STAGGER_DELAY * 3).springify()}>
            <Text style={styles.sectionTitle} tx="profileScreen:supportTitle" />
          </Animated.View>
          <Animated.View
            entering={FadeInDown.delay(ANIMATION.STAGGER_DELAY * 3.5).springify()}
            style={styles.menuGroup}
          >
            <MenuItem icon="help-circle-outline" title={t("profileScreen:helpCenter")} />
            <View style={styles.divider} />
            <MenuItem icon="shield-checkmark-outline" title={t("profileScreen:privacyPolicy")} />
          </Animated.View>

          {/* Development Section - Only visible in dev mode */}
          {features.enableDebugLogging && (
            <>
              <Animated.View entering={FadeInDown.delay(ANIMATION.STAGGER_DELAY * 3.8).springify()}>
                <Text style={styles.sectionTitle} tx="profileScreen:developmentTitle" />
              </Animated.View>
              <Animated.View
                entering={FadeInDown.delay(ANIMATION.STAGGER_DELAY * 4).springify()}
                style={styles.menuGroup}
              >
                {isRevenueCatMock && (
                  <>
                    <MenuItem
                      icon="diamond-outline"
                      title={isPro ? "Unsubscribe (Mock)" : "Subscribe (Mock)"}
                      subtitle={
                        isPro
                          ? "Toggle off mock Pro subscription"
                          : "Toggle on mock Pro subscription"
                      }
                      rightElement={
                        <Switch
                          value={isPro}
                          onValueChange={handleMockToggleSubscription}
                          trackColor={{
                            false: theme.colors.borderSecondary,
                            true: theme.colors.palette.success500,
                          }}
                          thumbColor={theme.colors.card}
                        />
                      }
                    />
                    <View style={styles.divider} />
                  </>
                )}
                <MenuItem
                  icon="bug-outline"
                  title={t("profileScreen:testSentryError")}
                  subtitle={t("profileScreen:testSentryErrorSubtitle")}
                  onPress={() => {
                    haptics.buttonPress()
                    testErrors.testSimpleError()
                  }}
                />
                <View style={styles.divider} />
                <MenuItem
                  icon="warning-outline"
                  title={t("profileScreen:testWarning")}
                  subtitle={t("profileScreen:testWarningSubtitle")}
                  onPress={() => {
                    haptics.buttonPress()
                    testErrors.testWarningMessage()
                  }}
                />
                <View style={styles.divider} />
                <MenuItem
                  icon="information-circle-outline"
                  title={t("profileScreen:testInfoMessage")}
                  subtitle={t("profileScreen:testInfoMessageSubtitle")}
                  onPress={() => {
                    haptics.buttonPress()
                    testErrors.testInfoMessage()
                  }}
                />
                <View style={styles.divider} />
                <MenuItem
                  icon="code-outline"
                  title={t("profileScreen:testErrorWithContext")}
                  subtitle={t("profileScreen:testErrorWithContextSubtitle")}
                  onPress={() => {
                    haptics.buttonPress()
                    testErrors.testErrorWithContext()
                  }}
                />
              </Animated.View>
            </>
          )}

          <Animated.View entering={FadeInDown.delay(ANIMATION.STAGGER_DELAY * 4).springify()}>
            <Text style={styles.sectionTitle} tx="profileScreen:accountTitle" />
          </Animated.View>
          <Animated.View
            entering={FadeInDown.delay(ANIMATION.STAGGER_DELAY * 4.5).springify()}
            style={styles.dangerCard}
          >
            <MenuItem
              icon="log-out-outline"
              title={t("profileScreen:signOut")}
              subtitle={t("profileScreen:signOutSubtitle")}
              onPress={handleSignOut}
            />
            <View style={styles.divider} />
            <View style={styles.dangerHeader}>
              <View style={styles.dangerCopy}>
                <Text style={styles.dangerTitle} tx="profileScreen:deleteAccount" />
                <Text style={styles.dangerSubtitle} tx="profileScreen:deleteAccountSubtitle" />
              </View>
              <View style={styles.dangerBadge}>
                <Ionicons name="shield-half-outline" size={16} color={theme.colors.error} />
                <Text style={styles.dangerBadgeText} tx="profileScreen:deleteAccountPrivacy" />
              </View>
            </View>

            <View style={styles.dangerBullets}>
              <View style={styles.dangerBullet}>
                <View style={styles.dangerIcon}>
                  <Ionicons name="trash-outline" size={16} color={theme.colors.error} />
                </View>
                <Text style={styles.dangerBulletText} tx="profileScreen:deleteAccountBullet1" />
              </View>
              <View style={styles.dangerBullet}>
                <View style={styles.dangerIcon}>
                  <Ionicons name="receipt-outline" size={16} color={theme.colors.error} />
                </View>
                <Text style={styles.dangerBulletText} tx="profileScreen:deleteAccountBullet2" />
              </View>
              <View style={styles.dangerBullet}>
                <View style={styles.dangerIcon}>
                  <Ionicons name="log-out-outline" size={16} color={theme.colors.error} />
                </View>
                <Text style={styles.dangerBulletText} tx="profileScreen:deleteAccountBullet3" />
              </View>
            </View>

            <Button
              tx="profileScreen:deleteMyAccount"
              variant="danger"
              onPress={() => {
                haptics.delete()
                setDeleteModalVisible(true)
              }}
              style={styles.dangerButton}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(ANIMATION.STAGGER_DELAY * 5.2).springify()}>
            <Text
              style={styles.versionText}
              tx="profileScreen:version"
              txOptions={{ version: "1.0.0", build: "12" }}
            />
          </Animated.View>
        </ScrollView>
      </LinearGradient>

      {/* Edit Profile Modal - Convex version with reactive mutations */}
      <EditProfileModalConvex
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        user={convexUser}
        onUpdate={handleProfileUpdate}
      />
      <DeleteAccountModal
        visible={deleteModalVisible}
        onClose={() => setDeleteModalVisible(false)}
      />
      <LanguageSelector
        visible={languageModalVisible}
        onClose={() => setLanguageModalVisible(false)}
      />
    </View>
  )
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    ...(isWeb && {
      minHeight: webDimension("100vh"),
    }),
  },
  gradient: {
    flex: 1,
    ...(isWeb && {
      minHeight: webDimension("100vh"),
    }),
  },
  scrollView: {
    flex: 1,
    ...(isWeb && {
      overflowY: "auto" as unknown as "scroll",
    }),
  },
  scrollContent: {
    paddingBottom: 120,
    paddingHorizontal: theme.spacing.lg,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.spacing.xl,
  },
  headerBadges: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  screenTitle: {
    color: theme.colors.foreground,
    fontFamily: theme.typography.fonts.bold,
    fontSize: theme.typography.sizes["3xl"],
    lineHeight: theme.typography.lineHeights["3xl"],
  },
  backendBadge: {
    color: theme.colors.foregroundTertiary,
    backgroundColor: theme.colors.backgroundSecondary,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xxs,
    borderRadius: theme.radius.md,
    fontSize: theme.typography.sizes.xs,
  },
  profileCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius["3xl"],
    marginBottom: theme.spacing.md,
    padding: theme.spacing.lg,
    ...theme.shadows.lg,
  },
  profileCardInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.lg,
  },
  profileInfo: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  profileName: {
    color: theme.colors.foreground,
    fontFamily: theme.typography.fonts.semiBold,
    fontSize: theme.typography.sizes.xl,
    lineHeight: theme.typography.lineHeights.xl,
  },
  profileEmail: {
    color: theme.colors.foregroundSecondary,
    fontFamily: theme.typography.fonts.regular,
    fontSize: theme.typography.sizes.sm,
    lineHeight: theme.typography.lineHeights.sm,
  },
  profileBio: {
    color: theme.colors.foregroundTertiary,
    fontFamily: theme.typography.fonts.regular,
    fontSize: theme.typography.sizes.sm,
    lineHeight: theme.typography.lineHeights.sm,
    marginTop: theme.spacing.xxs,
    marginBottom: theme.spacing.xs,
  },
  proBadge: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: theme.colors.foreground,
    borderRadius: theme.radius.lg,
    flexDirection: "row",
    gap: theme.spacing.xxs,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  proText: {
    color: theme.colors.background,
    fontFamily: theme.typography.fonts.semiBold,
    fontSize: 12,
    lineHeight: 14,
  } as const,
  mockBadge: {
    color: theme.colors.background,
    fontFamily: theme.typography.fonts.regular,
    fontSize: 10,
    lineHeight: 14,
    opacity: 0.7,
  } as const,
  upgradeButton: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  upgradeText: {
    color: theme.colors.primaryForeground,
    fontFamily: theme.typography.fonts.semiBold,
    fontSize: theme.typography.sizes.sm,
    lineHeight: theme.typography.lineHeights.sm,
  },
  infoCard: {
    backgroundColor: theme.colors.infoBackground,
    borderRadius: theme.radius["2xl"],
    padding: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  infoText: {
    flex: 1,
    color: theme.colors.primary,
  },
  sectionTitle: {
    color: theme.colors.foreground,
    fontFamily: theme.typography.fonts.bold,
    fontSize: theme.typography.sizes.lg,
    lineHeight: theme.typography.lineHeights.lg,
    marginBottom: theme.spacing.md,
    marginLeft: theme.spacing.xxs,
  },
  menuGroup: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius["2xl"],
    borderWidth: 1,
    gap: theme.spacing.xxs,
    marginBottom: theme.spacing.xl,
    padding: theme.spacing.xs,
    ...theme.shadows.sm,
  },
  divider: {
    backgroundColor: theme.colors.separator,
    height: 1,
    marginLeft: 56,
    opacity: 0.6,
  },
  dangerCard: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.errorBackground,
    borderRadius: theme.radius["2xl"],
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    ...theme.shadows.md,
  },
  dangerHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing.md,
  },
  dangerCopy: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  dangerTitle: {
    color: theme.colors.foreground,
    fontFamily: theme.typography.fonts.semiBold,
    fontSize: theme.typography.sizes.lg,
    lineHeight: theme.typography.lineHeights.lg,
  },
  dangerSubtitle: {
    color: theme.colors.foregroundSecondary,
    fontFamily: theme.typography.fonts.regular,
    fontSize: theme.typography.sizes.sm,
    lineHeight: theme.typography.lineHeights.sm,
  },
  dangerBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.errorBackground,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.full,
  },
  dangerBadgeText: {
    color: theme.colors.error,
    fontFamily: theme.typography.fonts.semiBold,
    fontSize: theme.typography.sizes.xs,
  },
  dangerBullets: {
    gap: theme.spacing.sm,
  },
  dangerBullet: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  dangerIcon: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.errorBackground,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerBulletText: {
    flex: 1,
    color: theme.colors.foreground,
    fontFamily: theme.typography.fonts.regular,
    fontSize: theme.typography.sizes.base,
    lineHeight: theme.typography.lineHeights.base,
  },
  dangerButton: {
    marginTop: theme.spacing.xs,
  },
  versionText: {
    color: theme.colors.foregroundTertiary,
    fontFamily: theme.typography.fonts.regular,
    fontSize: theme.typography.sizes.xs,
    lineHeight: theme.typography.lineHeights.xs,
    marginBottom: theme.spacing.xl,
    textAlign: "center",
  },
}))
