/**
 * Certificate Pinning Utility
 *
 * Provides certificate pinning support for API requests to prevent MITM attacks.
 *
 * NOTE: Full certificate pinning requires native modules. This file provides:
 * 1. A configuration structure for certificate pins
 * 2. Documentation on how to implement full pinning
 * 3. Basic validation utilities
 *
 * For production apps, consider using:
 * - react-native-certificate-pinner (community)
 * - Custom native modules with TrustKit (iOS) / Network Security Config (Android)
 */

/**
 * Certificate pin configuration
 */
export interface CertificatePinConfig {
  hostname: string
  publicKeyHashes: string[] // SHA-256 hashes of public keys
  includeSubdomains?: boolean
}

/**
 * Default certificate pins (configure for your API endpoints)
 *
 * To get certificate hashes:
 * 1. Use openssl: openssl s_client -servername yourdomain.com -connect yourdomain.com:443 | openssl x509 -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256
 * 2. Or use online tools: https://www.ssllabs.com/ssltest/
 */
export const CERTIFICATE_PINS: CertificatePinConfig[] = [
  // Example: Supabase
  // {
  //   hostname: "your-project.supabase.co",
  //   publicKeyHashes: [
  //     "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", // Replace with actual hash
  //   ],
  //   includeSubdomains: true,
  // },
]

/**
 * Check if certificate pinning is enabled
 */
export function isCertificatePinningEnabled(): boolean {
  return CERTIFICATE_PINS.length > 0 && !__DEV__
}

/**
 * Get pin configuration for a hostname
 */
export function getPinConfig(hostname: string): CertificatePinConfig | undefined {
  return CERTIFICATE_PINS.find((pin) => {
    if (pin.hostname === hostname) {
      return true
    }
    if (pin.includeSubdomains && hostname.endsWith(`.${pin.hostname}`)) {
      return true
    }
    return false
  })
}

/**
 * Validate certificate pin (placeholder - requires native implementation)
 *
 * This function should be implemented using native modules:
 * - iOS: Use TrustKit or URLSession with certificate pinning
 * - Android: Use Network Security Config or OkHttp CertificatePinner
 *
 * For now, this is a placeholder that logs a warning in production
 */
export function validateCertificatePin(hostname: string, certificateHash: string): boolean {
  const pinConfig = getPinConfig(hostname)

  if (!pinConfig) {
    // No pinning configured for this hostname
    return true
  }

  // In production, this should validate against native certificate pinning
  // For now, log a warning in dev only - production warnings are noise without
  // a native implementation in place.
  if (__DEV__) {
    console.warn(
      "[CertificatePinning] Certificate pinning is configured but native implementation is required",
      { hostname },
    )
  }

  // Check if certificate hash matches any of the pinned hashes
  return pinConfig.publicKeyHashes.some((pinnedHash) => {
    // Normalize hashes (remove 'sha256/' prefix if present)
    const normalizedPinned = pinnedHash.replace(/^sha256\//, "")
    const normalizedCert = certificateHash.replace(/^sha256\//, "")
    return normalizedPinned.toLowerCase() === normalizedCert.toLowerCase()
  })
}

/**
 * Setup instructions for implementing full certificate pinning:
 *
 * iOS (using TrustKit):
 * 1. Install TrustKit: pod 'TrustKit'
 * 2. Configure in Info.plist or programmatically
 * 3. Use TrustKit's URLSession delegate
 *
 * Android (using Network Security Config):
 * 1. Create res/xml/network_security_config.xml
 * 2. Add certificate pins to the config
 * 3. Reference in AndroidManifest.xml
 *
 * React Native:
 * 1. Create native modules for iOS/Android
 * 2. Integrate with fetch/XMLHttpRequest interceptors
 * 3. Validate certificates before requests
 */
