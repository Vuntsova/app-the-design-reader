import { I18nManager } from "react-native"
import * as Localization from "expo-localization"
import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import "intl-pluralrules"

import { storage } from "@/utils/storage"

// if English isn't your default language, move Translations to the appropriate language file.
import ar from "./ar"
import bg from "./bg"
import en, { Translations } from "./en"
import es from "./es"
import fr from "./fr"
import hi from "./hi"
import ja from "./ja"
import ko from "./ko"

const fallbackLocale = "en-US"
const LANGUAGE_STORAGE_KEY = "app_language"
const RTL_LANGUAGES = ["ar"] // Languages that use RTL layout

const systemLocales = Localization.getLocales()

const resources = { ar, bg, en, ko, es, fr, ja, hi }
const supportedTags = Object.keys(resources)

// Checks to see if the device locale matches any of the supported locales
// Device locale may be more specific and still match (e.g., en-US matches en)
const systemTagMatchesSupportedTags = (deviceTag: string) => {
  const primaryTag = deviceTag.split("-")[0]
  return supportedTags.includes(primaryTag)
}

const pickSupportedLocale: () => Localization.Locale | undefined = () => {
  return systemLocales.find((locale) => systemTagMatchesSupportedTags(locale.languageTag))
}

const locale = pickSupportedLocale()

// Determine the initial language - check persisted preference first, then device locale
const getInitialLanguage = (): string => {
  try {
    const persistedLanguage = storage.getString(LANGUAGE_STORAGE_KEY)
    if (persistedLanguage && supportedTags.includes(persistedLanguage)) {
      return persistedLanguage
    }
  } catch {
    // Storage not available, fall back to device locale
  }
  return locale?.languageTag?.split("-")[0] ?? fallbackLocale.split("-")[0]
}

const initialLanguage = getInitialLanguage()
export const isRTL = RTL_LANGUAGES.includes(initialLanguage)

// Need to set RTL ASAP to ensure the app is rendered correctly. Waiting for i18n to init is too late.
// Must call both allowRTL and forceRTL for the change to take effect
I18nManager.allowRTL(isRTL)
I18nManager.forceRTL(isRTL)

// Initialize i18n synchronously at module load time
// This ensures useTranslation hook always has a valid i18n instance
// and prevents hook order violations during initial render
i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: fallbackLocale,
  interpolation: {
    escapeValue: false,
  },
  // Initialize synchronously to prevent hook issues
  initImmediate: false,
})

export const initI18n = async () => {
  // i18n is already initialized synchronously above at module load time.
  // This function exists so callers that await it continue to work.
  return i18n
}

/**
 * Builds up valid keypaths for translations.
 */

export type TxKeyPath = RecursiveKeyOf<Translations>

// via: https://stackoverflow.com/a/65333050
type RecursiveKeyOf<TObj extends object> = {
  [TKey in keyof TObj & (string | number)]: RecursiveKeyOfHandleValue<TObj[TKey], `${TKey}`, true>
}[keyof TObj & (string | number)]

type RecursiveKeyOfInner<TObj extends object> = {
  [TKey in keyof TObj & (string | number)]: RecursiveKeyOfHandleValue<TObj[TKey], `${TKey}`, false>
}[keyof TObj & (string | number)]

type RecursiveKeyOfHandleValue<
  TValue,
  Text extends string,
  IsFirstLevel extends boolean,
> = TValue extends unknown[]
  ? Text
  : TValue extends object
    ? IsFirstLevel extends true
      ? Text | `${Text}:${RecursiveKeyOfInner<TValue>}`
      : Text | `${Text}.${RecursiveKeyOfInner<TValue>}`
    : Text

/**
 * Translates a key path to the corresponding string value
 */
export const translate = (key: TxKeyPath, options?: Record<string, unknown>): string => {
  return i18n.t(key, options)
}

/**
 * Re-export language switcher utilities
 */
export {
  changeLanguage,
  getCurrentLanguage,
  getPersistedLanguage,
  initializeLanguage,
  resetToDeviceLanguage,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from "./languageSwitcher"
