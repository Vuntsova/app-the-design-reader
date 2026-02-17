/**
 * OTPInput - A 6-digit code input component for OTP/verification codes
 *
 * Features:
 * - Auto-focus between digits
 * - Paste support (automatically distributes pasted code)
 * - Auto-submit on completion
 * - Visual separators between digit groups
 * - Keyboard navigation (backspace moves to previous)
 * - Accessible with screen readers
 * - Theme-aware styling
 *
 * @example
 * ```tsx
 * <OTPInput
 *   length={6}
 *   value={code}
 *   onChange={setCode}
 *   onComplete={(code) => verifyCode(code)}
 *   error={errorMessage}
 * />
 * ```
 */

import { useRef, useEffect, useCallback, useState } from "react"
/* eslint-disable no-restricted-imports -- OTPInput is a core component that needs the underlying RN TextInput */
import {
  View,
  TextInput,
  Pressable,
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
  Platform,
} from "react-native"
/* eslint-enable no-restricted-imports */
import { useTranslation } from "react-i18next"
import { StyleSheet, useUnistyles } from "react-native-unistyles"

import { Text } from "./Text"

// Lazy import expo-clipboard to prevent crashes when native module is missing
let ExpoClipboard: typeof import("expo-clipboard") | null = null
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ExpoClipboard = require("expo-clipboard")
} catch {
  // Native module not available - clipboard paste feature will be disabled
  console.warn("[OTPInput] expo-clipboard native module not available. Paste feature disabled.")
}

// =============================================================================
// TYPES
// =============================================================================

export interface OTPInputProps {
  /** Number of digits (default: 6) */
  length?: number
  /** Current value */
  value: string
  /** Called when value changes */
  onChange: (value: string) => void
  /** Called when all digits are entered */
  onComplete?: (code: string) => void
  /** Error message to display */
  error?: string
  /** Whether the input is disabled */
  disabled?: boolean
  /** Auto-focus on mount */
  autoFocus?: boolean
  /** Secure text entry (shows dots instead of numbers) */
  secure?: boolean
}

// =============================================================================
// COMPONENT
// =============================================================================

export const OTPInput = ({
  length = 6,
  value,
  onChange,
  onComplete,
  error,
  disabled = false,
  autoFocus = true,
  secure = false,
}: OTPInputProps) => {
  const { theme } = useUnistyles()
  const { t } = useTranslation()
  const inputRefs = useRef<(TextInput | null)[]>([])
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)
  const hasCalledComplete = useRef(false)

  // Convert value to array of digits
  const digits = value.split("").slice(0, length)
  while (digits.length < length) {
    digits.push("")
  }

  // Focus first empty input on mount
  useEffect(() => {
    if (autoFocus && !disabled) {
      const firstEmptyIndex = digits.findIndex((d) => !d)
      const indexToFocus = firstEmptyIndex === -1 ? length - 1 : firstEmptyIndex
      setTimeout(() => {
        inputRefs.current[indexToFocus]?.focus()
      }, 100)
    }
  }, [autoFocus, digits, disabled, length])

  // Call onComplete when all digits are filled
  useEffect(() => {
    if (value.length === length && onComplete && !hasCalledComplete.current) {
      hasCalledComplete.current = true
      onComplete(value)
    } else if (value.length < length) {
      hasCalledComplete.current = false
    }
  }, [value, length, onComplete])

  const handleChange = useCallback(
    (text: string, index: number) => {
      // Handle paste - distribute characters across inputs
      if (text.length > 1) {
        const pastedCode = text.replace(/\D/g, "").slice(0, length)
        onChange(pastedCode)

        // Focus last filled input or the one after paste
        const focusIndex = Math.min(pastedCode.length, length - 1)
        setTimeout(() => {
          inputRefs.current[focusIndex]?.focus()
        }, 0)
        return
      }

      // Handle single character input
      const digit = text.replace(/\D/g, "")
      if (digit.length === 0 && text.length > 0) {
        // Non-digit entered, ignore
        return
      }

      // Update the value
      const newDigits = [...digits]
      newDigits[index] = digit
      const newValue = newDigits.join("")
      onChange(newValue)

      // Move to next input if digit was entered
      if (digit && index < length - 1) {
        setTimeout(() => {
          inputRefs.current[index + 1]?.focus()
        }, 0)
      }
    },
    [digits, length, onChange],
  )

  const handleKeyPress = useCallback(
    (e: NativeSyntheticEvent<TextInputKeyPressEventData>, index: number) => {
      const key = e.nativeEvent.key

      // Handle backspace
      if (key === "Backspace") {
        if (!digits[index] && index > 0) {
          // Current input is empty, move to previous and clear it
          const newDigits = [...digits]
          newDigits[index - 1] = ""
          onChange(newDigits.join(""))
          setTimeout(() => {
            inputRefs.current[index - 1]?.focus()
          }, 0)
        } else if (digits[index]) {
          // Clear current input
          const newDigits = [...digits]
          newDigits[index] = ""
          onChange(newDigits.join(""))
        }
      }
    },
    [digits, onChange],
  )

  const handlePaste = useCallback(async () => {
    if (!ExpoClipboard) return // Clipboard not available
    try {
      const text = await ExpoClipboard.getStringAsync()
      if (text) {
        const pastedCode = text.replace(/\D/g, "").slice(0, length)
        if (pastedCode.length > 0) {
          onChange(pastedCode)
          const focusIndex = Math.min(pastedCode.length, length - 1)
          setTimeout(() => {
            inputRefs.current[focusIndex]?.focus()
          }, 0)
        }
      }
    } catch {
      // Clipboard access failed, ignore
    }
  }, [length, onChange])

  const handleFocus = useCallback((index: number) => {
    setFocusedIndex(index)
  }, [])

  const handleBlur = useCallback(() => {
    setFocusedIndex(null)
  }, [])

  const handlePress = useCallback(
    (index: number) => {
      if (!disabled) {
        inputRefs.current[index]?.focus()
      }
    },
    [disabled],
  )

  // Determine where to show the separator (after index 2 for 6-digit codes)
  const separatorIndex = Math.floor(length / 2) - 1

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        {digits.map((digit, index) => (
          <View key={index} style={styles.digitWrapper}>
            <Pressable
              onPress={() => handlePress(index)}
              style={[
                styles.digitContainer,
                focusedIndex === index && styles.digitContainerFocused,
                error && styles.digitContainerError,
                disabled && styles.digitContainerDisabled,
              ]}
              accessibilityRole="none"
            >
              <TextInput
                ref={(ref) => {
                  inputRefs.current[index] = ref
                }}
                style={[styles.digitInput, secure && digit && styles.digitInputSecure]}
                value={secure && digit ? "\u2022" : digit}
                onChangeText={(text) => handleChange(text, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                onFocus={() => handleFocus(index)}
                onBlur={handleBlur}
                keyboardType="number-pad"
                maxLength={length} // Allow paste
                editable={!disabled}
                selectTextOnFocus
                caretHidden={Platform.OS === "ios"}
                accessibilityLabel={t("otpInput:digitLabel", {
                  position: index + 1,
                  total: length,
                })}
                accessibilityHint={t("otpInput:digitHint")}
                testID={`otp-input-${index}`}
              />
            </Pressable>

            {/* Separator after middle digits */}
            {index === separatorIndex && (
              <View style={styles.separator}>
                <View style={[styles.separatorDot, { backgroundColor: theme.colors.border }]} />
              </View>
            )}
          </View>
        ))}
      </View>

      {/* Error message */}
      {error && (
        <View style={styles.errorContainer}>
          <Text size="sm" color="error" style={styles.errorText}>
            {error}
          </Text>
        </View>
      )}

      {/* Paste hint for mobile (only shown when clipboard is available) */}
      {Platform.OS !== "web" && ExpoClipboard && (
        <Pressable onPress={handlePaste} style={styles.pasteHint} accessibilityRole="button">
          <Text
            size="sm"
            color="secondary"
            style={styles.pasteHintText}
            tx="otpInput:pasteFromClipboard"
          />
        </Pressable>
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
  inputRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  digitWrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  digitContainer: {
    width: 48,
    height: 56,
    borderRadius: theme.radius.lg,
    borderWidth: 2,
    borderColor: theme.colors.inputBorder,
    backgroundColor: theme.colors.input,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  digitContainerFocused: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
    ...theme.shadows.sm,
  },
  digitContainerError: {
    borderColor: theme.colors.error,
  },
  digitContainerDisabled: {
    opacity: 0.5,
    backgroundColor: theme.colors.secondary,
  },
  digitInput: {
    width: "100%",
    height: "100%",
    textAlign: "center",
    fontSize: theme.typography.sizes["2xl"],
    fontFamily: theme.typography.fonts.bold,
    color: theme.colors.foreground,
    padding: 0,
  },
  digitInputSecure: {
    fontSize: theme.typography.sizes["3xl"],
  },
  separator: {
    width: theme.spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  separatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  errorContainer: {
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  errorText: {
    textAlign: "center",
  },
  pasteHint: {
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
  },
  pasteHintText: {
    textDecorationLine: "underline",
  },
}))
