import { useState } from "react"
import { Pressable, View } from "react-native"
import { zodResolver } from "@hookform/resolvers/zod"
import { useNavigation } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { Controller, useForm } from "react-hook-form"
import { StyleSheet } from "react-native-unistyles"
import { z } from "zod"

import { useChart } from "@/hooks"

import { BirthPlaceField } from "@/components/BirthPlaceField"
import { BodyGraph } from "@/components/BodyGraph"
import { Container } from "@/components/Container"
import { DatePicker } from "@/components/DatePicker"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"

import { type TxKeyPath } from "@/i18n"
import type { AppStackParamList } from "@/navigators/navigationTypes"
import type { ChartRequest } from "@/services/chart"

// Zod messages are i18n keys, translated at render time by the field
// components (DatePicker.errorTx, TextField.helperTx).
const schema = z.object({
  datetime: z.date({ message: "birthDataScreen:errors.datetimeRequired" }),
  location: z.string().min(1, "birthDataScreen:errors.locationRequired"),
  name: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const pad = (n: number) => String(n).padStart(2, "0")
const toApiDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const toApiTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

export const BirthDataScreen = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<AppStackParamList>>()

  // Submitted request drives useChart. A birth chart is cached forever for a
  // given (date, time, location) — re-submitting the same values is free.
  const [request, setRequest] = useState<ChartRequest | undefined>(undefined)
  const { data, error, isFetching } = useChart(request)

  const {
    control,
    handleSubmit,
    formState: { isValid },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: { location: "", name: "" } as FormData,
  })

  const onSubmit = (form: FormData) => {
    setRequest({
      date: toApiDate(form.datetime),
      time: toApiTime(form.datetime),
      location: form.location,
      name: form.name || undefined,
    })
  }

  return (
    <Container preset="scroll" keyboardAvoiding safeAreaEdges={["top", "bottom"]}>
      <View style={styles.container}>
        <Text preset="heading" tx="birthDataScreen:title" />
        <Text color="secondary" tx="birthDataScreen:subtitle" style={styles.subtitle} />

        <Controller
          control={control}
          name="datetime"
          render={({ field, fieldState }) => (
            <DatePicker
              mode="datetime"
              value={field.value}
              onChange={field.onChange}
              labelTx="birthDataScreen:datetimeLabel"
              placeholderTx="birthDataScreen:datetimePlaceholder"
              helperTx="birthDataScreen:datetimeHelper"
              errorTx={fieldState.error?.message as TxKeyPath | undefined}
              maxDate={new Date()}
              style={styles.field}
            />
          )}
        />

        {/* Location must come from a /geocode result — free text bounces off
            the engine's ALLOWED_PLACE_PAIRS. RHF's `location` value is only
            set when the user picks a suggestion; typing after selection
            clears it, so the submit button stays disabled until a valid
            result is chosen. */}
        <Controller
          control={control}
          name="location"
          render={({ field, fieldState }) => (
            <BirthPlaceField
              value={field.value ?? ""}
              onSelect={field.onChange}
              onBlur={field.onBlur}
              errorTx={fieldState.error?.message as TxKeyPath | undefined}
              style={styles.field}
            />
          )}
        />

        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <TextField
              value={field.value ?? ""}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              labelTx="birthDataScreen:nameLabel"
              placeholderTx="birthDataScreen:namePlaceholder"
              autoCapitalize="words"
              autoCorrect={false}
              containerStyle={styles.field}
            />
          )}
        />

        <Pressable
          onPress={handleSubmit(onSubmit)}
          disabled={!isValid || isFetching}
          style={[styles.submit, (!isValid || isFetching) && styles.submitDisabled]}
          accessibilityRole="button"
        >
          <Text
            weight="semiBold"
            style={styles.submitText}
            tx={isFetching ? "birthDataScreen:loading" : "birthDataScreen:submitButton"}
          />
        </Pressable>

        {error ? (
          <View style={styles.errorBox}>
            <Text tx="birthDataScreen:errorTitle" color="error" weight="semiBold" />
            <Text size="sm" color="error">
              {error instanceof Error ? error.message : String(error)}
            </Text>
          </View>
        ) : null}

        {data && request ? (
          <Pressable
            onPress={() => navigation.navigate("MyChart", { request })}
            style={styles.viewChartButton}
            accessibilityRole="button"
          >
            <Text
              weight="semiBold"
              style={styles.viewChartButtonText}
              tx="myChartScreen:openFromBirthData"
            />
          </Pressable>
        ) : null}

        {data ? <BodyGraph chart={data.chart} style={styles.bodyGraph} /> : null}

        {/* Raw JSON dump — kept below the BodyGraph while the graph is
            still Phase 1. Will disappear once we trust the render. */}
        {data ? (
          <View style={styles.resultBox}>
            <Text
              tx="birthDataScreen:resultTitle"
              weight="semiBold"
              style={styles.resultTitle}
            />
            <Text size="xs" style={styles.resultJson}>
              {JSON.stringify(data, null, 2)}
            </Text>
          </View>
        ) : null}
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
  field: {
    marginBottom: theme.spacing.md,
  },
  submit: {
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    ...theme.shadows.md,
  },
  submitDisabled: {
    opacity: 0.4,
  },
  submitText: {
    color: theme.colors.primaryForeground,
    fontSize: theme.typography.sizes.lg,
  },
  viewChartButton: {
    alignItems: "center",
    backgroundColor: theme.colors.secondary,
    borderRadius: theme.radius.lg,
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
  },
  viewChartButtonText: {
    color: theme.colors.secondaryForeground,
    fontSize: theme.typography.sizes.lg,
  },
  errorBox: {
    backgroundColor: theme.colors.errorBackground,
    borderRadius: theme.radius.md,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  bodyGraph: {
    width: "100%",
    alignSelf: "center",
    // Matches VIEWBOX aspect ratio in geometry.ts (375 × 750 — target is a
    // 375px-wide iPhone).
    aspectRatio: 375 / 750,
    marginTop: theme.spacing.lg,
  },
  resultBox: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
  },
  resultTitle: {
    marginBottom: theme.spacing.sm,
  },
  resultJson: {
    color: theme.colors.foreground,
    fontFamily: theme.typography.fonts.regular,
  },
}))
