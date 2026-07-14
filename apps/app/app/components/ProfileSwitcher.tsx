import { useState, type FC } from "react"
import { Modal, Pressable, ScrollView, View } from "react-native"
import { useNavigation } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { useTranslation } from "react-i18next"
import { StyleSheet } from "react-native-unistyles"

import { useActiveProfile, useProfileStore } from "@/stores/profiles"
import type { Relationship } from "@/stores/profiles"

import { Text } from "@/components/Text"

import type { AppStackParamList } from "@/navigators/navigationTypes"

// The three relations users can add. "self" is deliberately absent — the
// primary profile is created once through the BirthData form (no relationship
// param) and edited via setPrimary; it cannot be duplicated.
const RELATIONS: readonly Relationship[] = ["partner", "friend", "child"]

export const ProfileSwitcher: FC = () => {
  const { t } = useTranslation()
  const navigation =
    useNavigation<NativeStackNavigationProp<AppStackParamList>>()
  const profiles = useProfileStore((s) => s.profiles)
  const setActive = useProfileStore((s) => s.setActive)
  const remove = useProfileStore((s) => s.remove)
  const activeProfile = useActiveProfile()

  const [open, setOpen] = useState(false)

  const close = () => setOpen(false)

  const handleSelect = (id: string) => {
    setActive(id)
    close()
  }

  const handleAdd = (relationship: Relationship) => {
    close()
    navigation.navigate("BirthData", { relationship })
  }

  const handleDelete = (id: string) => {
    // Store no-ops on the primary and returns false; UI hides the delete
    // button on that row anyway, so this is defense in depth.
    remove(id)
  }

  const activeLabel = activeProfile
    ? activeProfile.isPrimary
      ? t("profileSwitcher:primary" as never)
      : t(
          `profileSwitcher:relationship.${activeProfile.relationship!}` as never,
        )
    : ""

  return (
    <View>
      <Pressable
        onPress={() => setOpen(true)}
        style={styles.trigger}
        accessibilityRole="button"
      >
        {activeProfile ? (
          <View style={styles.triggerRow}>
            <Text weight="semiBold">{activeProfile.name}</Text>
            <Text size="xs" color="secondary">
              {activeLabel}
            </Text>
          </View>
        ) : (
          <Text color="secondary" tx="profileSwitcher:noneSelected" />
        )}
        <Text size="xs" color="secondary" tx="profileSwitcher:tapToSwitch" />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={close}
      >
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable
            style={styles.sheet}
            onPress={(e) => e.stopPropagation()}
          >
            <Text
              preset="subheading"
              tx="profileSwitcher:title"
              style={styles.sheetTitle}
            />

            <ScrollView style={styles.list}>
              {profiles.length === 0 ? (
                <Text
                  color="secondary"
                  tx="profileSwitcher:noProfiles"
                  style={styles.emptyRow}
                />
              ) : (
                profiles.map((p) => {
                  const isActive = p.id === activeProfile?.id
                  const rowLabel = p.isPrimary
                    ? t("profileSwitcher:primary" as never)
                    : t(
                        `profileSwitcher:relationship.${p.relationship!}` as never,
                      )
                  return (
                    <View key={p.id} style={styles.row}>
                      <Pressable
                        style={styles.rowSelect}
                        onPress={() => handleSelect(p.id)}
                        accessibilityRole="button"
                      >
                        <Text weight={isActive ? "semiBold" : "regular"}>
                          {p.name}
                          {isActive ? " •" : ""}
                        </Text>
                        <Text size="xs" color="secondary">
                          {rowLabel}
                          {" · "}
                          {p.date}
                        </Text>
                      </Pressable>
                      {/* Delete is hidden on the primary — the store would
                          no-op anyway, but the affordance shouldn't lie. */}
                      {p.isPrimary ? null : (
                        <Pressable
                          style={styles.deleteButton}
                          onPress={() => handleDelete(p.id)}
                          accessibilityRole="button"
                          accessibilityLabel={t(
                            "profileSwitcher:delete" as never,
                          )}
                        >
                          <Text
                            size="xs"
                            color="error"
                            tx="profileSwitcher:delete"
                          />
                        </Pressable>
                      )}
                    </View>
                  )
                })
              )}
            </ScrollView>

            <View style={styles.divider} />

            <Text
              size="xs"
              color="secondary"
              tx="profileSwitcher:addHeader"
              style={styles.addHeader}
            />
            <View style={styles.addRow}>
              {RELATIONS.map((rel) => (
                <Pressable
                  key={rel}
                  style={styles.addButton}
                  onPress={() => handleAdd(rel)}
                  accessibilityRole="button"
                >
                  <Text
                    size="sm"
                    weight="semiBold"
                    tx={`profileSwitcher:add.${rel}` as never}
                  />
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  trigger: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.xxs,
  },
  triggerRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: theme.spacing.sm,
  },
  backdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: "center",
    padding: theme.spacing.lg,
  },
  sheet: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    maxHeight: "80%",
    gap: theme.spacing.md,
  },
  sheetTitle: {
    marginBottom: theme.spacing.sm,
  },
  list: {
    maxHeight: 320,
  },
  emptyRow: {
    paddingVertical: theme.spacing.md,
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.separator,
    gap: theme.spacing.md,
  },
  rowSelect: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  deleteButton: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.separator,
  },
  addHeader: {
    marginTop: theme.spacing.xs,
  },
  addRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  addButton: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.secondary,
  },
}))
