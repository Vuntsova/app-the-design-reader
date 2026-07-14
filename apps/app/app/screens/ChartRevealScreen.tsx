import { type FC } from "react"
import { Pressable, View } from "react-native"
import { useNavigation } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { StyleSheet } from "react-native-unistyles"

import { useChart } from "@/hooks"

import { Container } from "@/components/Container"
import { Text } from "@/components/Text"

import type { AppStackParamList } from "@/navigators/navigationTypes"
import type { ChartRequest } from "@/services/chart"
import { useActiveProfile } from "@/stores/profiles"
import { useSubscriptionStore } from "@/stores/subscriptionStore"

/**
 * The reveal moment. Shown once after birth data is submitted for the primary
 * profile — before any paywall. PROJECT.md → Onboarding flow requires that
 * users see real HD content (their Type, Strategy, Authority) BEFORE any
 * ask for money. This screen is that content.
 *
 * "Continue" routes to Paywall for free users (soft ask; the paywall is
 * dismissable and the chart is free) or straight to MyChart for pro users.
 * Adding a partner / friend / child later is what the paywall actually
 * gates — see ProfileSwitcher.
 */
export const ChartRevealScreen: FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<AppStackParamList>>()
  const activeProfile = useActiveProfile()
  const isPro = useSubscriptionStore((s) => s.isPro)

  const request: ChartRequest | undefined = activeProfile
    ? {
        name: activeProfile.name,
        date: activeProfile.date,
        time: activeProfile.time,
        location: activeProfile.location,
      }
    : undefined

  const { data, isFetching, error } = useChart(request, activeProfile?.id)
  const chart = data?.chart

  const handleContinue = () => {
    if (isPro) {
      navigation.navigate("MyChart")
    } else {
      navigation.navigate("Paywall")
    }
  }

  return (
    <Container preset="scroll" safeAreaEdges={["top", "bottom"]}>
      <View style={styles.container}>
        {isFetching && !chart ? (
          <Text tx="chartRevealScreen:loading" color="secondary" />
        ) : error ? (
          <Text color="error">
            {error instanceof Error ? error.message : String(error)}
          </Text>
        ) : !chart ? (
          <Text tx="chartRevealScreen:noData" color="secondary" />
        ) : (
          <>
            <Text preset="heading" tx="chartRevealScreen:title" />
            <Text
              tx="chartRevealScreen:subtitle"
              color="secondary"
              style={styles.subtitle}
            />

            <View style={styles.card}>
              <Text
                tx="chartRevealScreen:typeLabel"
                size="sm"
                color="secondary"
                weight="semiBold"
              />
              <Text weight="bold" size="2xl">
                {chart.type}
              </Text>
            </View>

            <View style={styles.card}>
              <Text
                tx="chartRevealScreen:strategyLabel"
                size="sm"
                color="secondary"
                weight="semiBold"
              />
              <Text weight="bold" size="2xl">
                {chart.strategy}
              </Text>
            </View>

            <View style={styles.card}>
              <Text
                tx="chartRevealScreen:authorityLabel"
                size="sm"
                color="secondary"
                weight="semiBold"
              />
              <Text weight="bold" size="2xl">
                {chart.authority}
              </Text>
            </View>

            <Pressable
              onPress={handleContinue}
              style={styles.continueButton}
              accessibilityRole="button"
            >
              <Text
                weight="semiBold"
                style={styles.continueText}
                tx="chartRevealScreen:continue"
              />
            </Pressable>
          </>
        )}
      </View>
    </Container>
  )
}

const styles = StyleSheet.create((theme) => ({
  container: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  subtitle: {
    marginBottom: theme.spacing.md,
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.xs,
  },
  continueButton: {
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    marginTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    ...theme.shadows.md,
  },
  continueText: {
    color: theme.colors.primaryForeground,
    fontSize: theme.typography.sizes.lg,
  },
}))
