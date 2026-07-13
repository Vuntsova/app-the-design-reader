// Note the syntax of these imports from the date-fns library.
// If you import with the syntax: import { format } from "date-fns" the ENTIRE library
// will be included in your production bundle (even if you only use one function).
// This is because react-native does not support tree-shaking.
import { format } from "date-fns/format"
import type { Locale } from "date-fns/locale"
import { parseISO } from "date-fns/parseISO"
import i18n from "i18next"

type Options = Parameters<typeof format>[2]

// date-fns locale modules are CJS with a single named export ("bg", "enUS", …).
// Using `.default` returns undefined at runtime, which silently falls back to English.
let dateFnsLocale: Locale
export const loadDateFnsLocale = () => {
  const primaryTag = i18n.language.split("-")[0]
  switch (primaryTag) {
    case "en":
      dateFnsLocale = require("date-fns/locale/en-US").enUS
      break
    case "ar":
      dateFnsLocale = require("date-fns/locale/ar").ar
      break
    case "bg":
      dateFnsLocale = require("date-fns/locale/bg").bg
      break
    case "ko":
      dateFnsLocale = require("date-fns/locale/ko").ko
      break
    case "es":
      dateFnsLocale = require("date-fns/locale/es").es
      break
    case "fr":
      dateFnsLocale = require("date-fns/locale/fr").fr
      break
    case "hi":
      dateFnsLocale = require("date-fns/locale/hi").hi
      break
    case "ja":
      dateFnsLocale = require("date-fns/locale/ja").ja
      break
    default:
      dateFnsLocale = require("date-fns/locale/en-US").enUS
      break
  }
}

export const formatDate = (date: string, dateFormat?: string, options?: Options) => {
  const dateOptions = {
    ...options,
    locale: dateFnsLocale,
  }
  return format(parseISO(date), dateFormat ?? "MMM dd, yyyy", dateOptions)
}
