import { useState, type FC } from "react"
import { Pressable, View, type ViewStyle } from "react-native"
import { StyleSheet } from "react-native-unistyles"

import { useGeocodeSearch } from "@/hooks"

import { Text } from "./Text"
import { TextField } from "./TextField"

import { type TxKeyPath } from "@/i18n"

export interface BirthPlaceFieldProps {
  // The currently selected display_name. Empty string when nothing selected.
  value: string
  // Called with the selected display_name, or "" when the user edits the text
  // and thereby invalidates the current selection.
  onSelect: (displayName: string) => void
  onBlur?: () => void
  // Zod error message routed in as an i18n key.
  errorTx?: TxKeyPath
  style?: ViewStyle
}

/**
 * Autocompleting birth-place field.
 *
 * Users can only submit a value that came from a `/geocode` result — free text
 * is not allowed, because the chart engine's ALLOWED_PLACE_PAIRS bounces
 * anything that isn't city/town/municipality/island/country with a 400.
 *
 * The RHF form's `location` value is only set when the user picks a result.
 * Typing after a selection immediately clears it back to "".
 */
export const BirthPlaceField: FC<BirthPlaceFieldProps> = ({
  value,
  onSelect,
  onBlur,
  errorTx,
  style,
}) => {
  const [query, setQuery] = useState(value)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const { data: results, isFetching } = useGeocodeSearch(query)

  // NOTE: no useEffect to sync `query` back to `value`. Every legitimate
  // transition (select, edit-after-select) is handled by our two handlers,
  // and a sync would fight the user's own typing when we call onSelect("").
  // If we ever add form.reset() support, use a ref-based sync then.

  const isSelected = value !== "" && query === value
  const hasActiveSearch = query.trim().length >= 2 && !isSelected
  const showDropdown = dropdownOpen && hasActiveSearch

  const handleChangeText = (text: string) => {
    setQuery(text)
    setDropdownOpen(true)
    if (value !== "") onSelect("")
  }

  const handleSelect = (displayName: string) => {
    setQuery(displayName)
    setDropdownOpen(false)
    onSelect(displayName)
  }

  // Helper priority: zod error → pick-a-result prompt (active search) → default.
  const helperTx: TxKeyPath | undefined = errorTx
    ? errorTx
    : hasActiveSearch
      ? "birthDataScreen:locationPickPrompt"
      : "birthDataScreen:locationHelper"

  return (
    <View style={style}>
      <TextField
        value={query}
        onChangeText={handleChangeText}
        onFocus={() => setDropdownOpen(true)}
        onBlur={onBlur}
        labelTx="birthDataScreen:locationLabel"
        placeholderTx="birthDataScreen:locationPlaceholder"
        status={errorTx ? "error" : "default"}
        helperTx={helperTx}
        autoCapitalize="words"
        autoCorrect={false}
      />

      {showDropdown ? (
        <View style={styles.dropdown}>
          {isFetching && (!results || results.length === 0) ? (
            <View style={styles.dropdownRow}>
              <Text tx="birthDataScreen:locationSearching" color="secondary" size="sm" />
            </View>
          ) : results && results.length > 0 ? (
            results.map((r, i) => (
              <Pressable
                key={`${r.display_name}|${r.lat}|${r.lng}`}
                onPress={() => handleSelect(r.display_name)}
                style={[styles.dropdownRow, i === results.length - 1 && styles.dropdownRowLast]}
                accessibilityRole="button"
                accessibilityLabel={r.display_name}
              >
                <Text>{r.display_name}</Text>
              </Pressable>
            ))
          ) : (
            <View style={styles.dropdownRow}>
              <Text tx="birthDataScreen:locationNoResults" color="secondary" size="sm" />
            </View>
          )}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  dropdown: {
    marginTop: theme.spacing.xs,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
  },
  dropdownRow: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.separator,
  },
  dropdownRowLast: {
    borderBottomWidth: 0,
  },
}))
