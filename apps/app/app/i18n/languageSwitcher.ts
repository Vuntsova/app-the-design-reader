import { I18nManager, Platform } from "react-native"
import * as Updates from "expo-updates"
import i18n from "i18next"

import { loadDateFnsLocale } from "@/utils/formatDate"
import { logger } from "@/utils/Logger"
import { storage } from "@/utils/storage"

/**
 * Storage key for persisted language preference
 */
const LANGUAGE_STORAGE_KEY = "app_language"

/**
 * Supported language codes
 */
export const SUPPORTED_LANGUAGES = {
  ar: "Arabic",
  bg: "Bulgarian",
  en: "English",
  es: "Spanish",
  fr: "French",
  hi: "Hindi",
  ja: "Japanese",
  ko: "Korean",
} as const

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES

/**
 * Get the current language code
 */
export const getCurrentLanguage = (): string => {
  return i18n.language.split("-")[0]
}

/**
 * Get the persisted language preference from storage
 */
export const getPersistedLanguage = (): string | null => {
  try {
    return storage.getString(LANGUAGE_STORAGE_KEY) || null
  } catch {
    return null
  }
}

/**
 * Change the app language
 * @param languageCode - Language code (e.g., 'en', 'es', 'fr')
 * @param persist - Whether to persist the language preference (default: true)
 */
export const changeLanguage = async (
  languageCode: SupportedLanguage,
  persist: boolean = true,
): Promise<void> => {
  // Validate language code
  if (!SUPPORTED_LANGUAGES[languageCode]) {
    logger.warn("Unsupported language code, falling back to 'en'", { languageCode })
    return changeLanguage("en", persist)
  }

  // Persist preference if requested
  if (persist) {
    try {
      storage.set(LANGUAGE_STORAGE_KEY, languageCode)
    } catch (error) {
      logger.warn("Failed to persist language preference", { error })
    }
  }

  // Change i18n language
  await i18n.changeLanguage(languageCode)

  // Update RTL support
  const isRTL = languageCode === "ar"
  const wasRTL = I18nManager.isRTL
  I18nManager.allowRTL(isRTL)
  I18nManager.forceRTL(isRTL)

  // Reload date-fns locale
  await loadDateFnsLocale()

  // RTL changes require app restart on native platforms
  if (Platform.OS !== "web" && wasRTL !== isRTL) {
    // Small delay to allow storage to persist before reload
    await new Promise((resolve) => setTimeout(resolve, 100))

    try {
      // expo-updates works in both dev and production with Expo SDK 54+
      await Updates.reloadAsync()
    } catch (error) {
      logger.warn("RTL change requires app restart. Please restart the app manually.", { error })
    }
  }
}

/**
 * Initialize language from persisted preference or device locale
 * This should be called during app initialization, after initI18n
 */
export const initializeLanguage = async (): Promise<void> => {
  // Try to get persisted language first
  const persistedLanguage = getPersistedLanguage()
  if (persistedLanguage && SUPPORTED_LANGUAGES[persistedLanguage as SupportedLanguage]) {
    await changeLanguage(persistedLanguage as SupportedLanguage, false) // Don't persist again
    return
  }

  // Otherwise, i18n will use device locale (already set in initI18n)
  // Just ensure date-fns locale is loaded
  await loadDateFnsLocale()
}

/**
 * Reset language to device default
 */
export const resetToDeviceLanguage = async (): Promise<void> => {
  // Clear persisted preference
  try {
    storage.delete(LANGUAGE_STORAGE_KEY)
  } catch (error) {
    logger.warn("Failed to clear language preference", { error })
  }

  // Get device locale
  const deviceLanguage = i18n.options.lng || "en"
  const primaryTag = deviceLanguage.split("-")[0] as SupportedLanguage

  // Change to device language
  if (SUPPORTED_LANGUAGES[primaryTag]) {
    await changeLanguage(primaryTag, false)
  } else {
    // Fallback to English
    await changeLanguage("en", false)
  }
}
