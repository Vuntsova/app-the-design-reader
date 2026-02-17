/**
 * Certificate pinning configuration service.
 *
 * Configure pins with:
 * EXPO_PUBLIC_ENABLE_CERTIFICATE_PINNING=true
 * EXPO_PUBLIC_CERTIFICATE_PINS={"api.example.com":["sha256/...","sha256/..."]}
 */

import { env, isProduction } from "../config/env"
import { logger } from "../utils/Logger"

type PinConfig = Record<string, string[]>

function parseCertificatePins(rawPins: string | undefined): PinConfig {
  if (!rawPins) return {}

  try {
    const parsed = JSON.parse(rawPins) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {}
    }

    return Object.fromEntries(
      Object.entries(parsed)
        .filter((entry): entry is [string, unknown] => typeof entry[0] === "string")
        .map(([domain, value]) => {
          const pins = Array.isArray(value)
            ? value.filter((pin): pin is string => typeof pin === "string" && pin.length > 0)
            : []
          return [domain, pins]
        })
        .filter(([, pins]) => pins.length > 0),
    )
  } catch {
    return {}
  }
}

const CERTIFICATE_PINS = parseCertificatePins(env.certificatePins)

export function isCertificatePinningEnabled(): boolean {
  return isProduction && env.enableCertificatePinning
}

export function isCertificatePinningConfigured(): boolean {
  return Object.keys(CERTIFICATE_PINS).length > 0
}

export function getCertificatePins(domain: string): string[] | null {
  return CERTIFICATE_PINS[domain] || null
}

type CertificateHashSource =
  | string
  | {
      publicKeyHash?: string
      certificateHash?: string
      hash?: string
    }
  | null
  | undefined

function normalizeCertificateHash(hash: string): string {
  return hash.replace(/^sha256\//, "").toLowerCase()
}

function extractCertificateHash(certificate: CertificateHashSource): string | null {
  if (!certificate) return null
  if (typeof certificate === "string") return certificate
  return certificate.publicKeyHash || certificate.certificateHash || certificate.hash || null
}

export async function validateCertificatePin(
  domain: string,
  certificate: CertificateHashSource,
): Promise<boolean> {
  if (!isCertificatePinningEnabled()) {
    return true
  }

  const pins = getCertificatePins(domain)
  if (!pins || pins.length === 0) {
    logger.error("[CertificatePinning] Missing certificate pins for domain", { domain })
    return false
  }

  const certificateHash = extractCertificateHash(certificate)
  if (!certificateHash) {
    logger.error("[CertificatePinning] Missing certificate hash for validation", { domain })
    return false
  }

  const normalizedHash = normalizeCertificateHash(certificateHash)
  const matches = pins.some((pin) => normalizeCertificateHash(pin) === normalizedHash)
  if (!matches) {
    logger.error("[CertificatePinning] Certificate hash mismatch", { domain })
  }
  return matches
}

export function initializeCertificatePinning(): void {
  if (!isCertificatePinningEnabled()) {
    if (__DEV__) {
      logger.debug("[CertificatePinning] Disabled")
    }
    return
  }

  if (!isCertificatePinningConfigured()) {
    logger.error(
      "[CertificatePinning] Enabled in production but EXPO_PUBLIC_CERTIFICATE_PINS is missing or invalid",
    )
    return
  }

  logger.info("[CertificatePinning] Enabled", {
    domains: Object.keys(CERTIFICATE_PINS),
  })
}

export const certificatePinning = {
  isEnabled: isCertificatePinningEnabled,
  isConfigured: isCertificatePinningConfigured,
  getPins: getCertificatePins,
  validate: validateCertificatePin,
  initialize: initializeCertificatePinning,
}
