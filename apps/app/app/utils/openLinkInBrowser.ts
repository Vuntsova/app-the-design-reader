import { Linking } from "react-native"

import { logger } from "./Logger"

/**
 * Helper for opening a give URL in an external browser.
 */
const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"])

export async function openLinkInBrowser(url: string): Promise<boolean> {
  try {
    const parsedUrl = new URL(url)
    if (!ALLOWED_PROTOCOLS.has(parsedUrl.protocol)) {
      logger.warn("[openLinkInBrowser] Blocked URL with unsupported protocol", {
        protocol: parsedUrl.protocol,
      })
      return false
    }

    const canOpen = await Linking.canOpenURL(url)
    if (!canOpen) {
      logger.warn("[openLinkInBrowser] URL cannot be opened", { protocol: parsedUrl.protocol })
      return false
    }

    await Linking.openURL(url)
    return true
  } catch (error) {
    logger.error("[openLinkInBrowser] Failed to open URL", {}, error as Error)
    return false
  }
}
