/**
 * Security Configuration Check
 *
 * Validates that security features are properly configured
 * Run this during app initialization to ensure security is enabled
 */

import { logger } from "./Logger"
import { certificatePinning } from "../services/certificatePinning"

interface SecurityCheckResult {
  certificatePinning: {
    enabled: boolean
    configured: boolean
    message: string
  }
  environment: {
    isProduction: boolean
    isDevelopment: boolean
    message: string
  }
  overall: {
    status: "secure" | "warning" | "error"
    message: string
  }
}

/**
 * Run security configuration checks
 */
export function runSecurityChecks(): SecurityCheckResult {
  const isProduction = !__DEV__
  const isDevelopment = __DEV__

  // Check certificate pinning
  const pinningEnabled = certificatePinning.isEnabled()
  const pinningConfigured = certificatePinning.isConfigured()

  const result: SecurityCheckResult = {
    certificatePinning: {
      enabled: pinningEnabled,
      configured: pinningConfigured,
      message: !pinningEnabled
        ? "Certificate pinning disabled"
        : pinningConfigured
          ? "Certificate pinning is enabled and configured"
          : "Certificate pinning enabled but no pins configured",
    },
    environment: {
      isProduction,
      isDevelopment,
      message: isProduction ? "Running in production mode" : "Running in development mode",
    },
    overall: {
      status: "secure",
      message: "Security checks passed",
    },
  }

  // Determine overall status
  if (isProduction && pinningEnabled && !pinningConfigured) {
    result.overall.status = "error"
    result.overall.message = "Certificate pinning is enabled but no certificate pins are configured"
  } else if (isProduction && !pinningEnabled) {
    result.overall.status = "warning"
    result.overall.message = "Certificate pinning is disabled in production"
  } else if (isProduction && pinningEnabled && pinningConfigured) {
    result.overall.status = "secure"
    result.overall.message = "All security checks passed"
  } else {
    result.overall.status = "secure"
    result.overall.message = "Development mode - security checks passed"
  }

  return result
}

/**
 * Log security check results
 */
export function logSecurityChecks(): void {
  const checks = runSecurityChecks()

  if (__DEV__) {
    logger.debug("Security Configuration Check", {
      certificatePinning: checks.certificatePinning,
      environment: checks.environment,
      overall: checks.overall,
    })
  } else {
    // In production, only log warnings or errors
    if (checks.overall.status === "warning" || checks.overall.status === "error") {
      logger.warn("Security Configuration Warning", {
        certificatePinning: checks.certificatePinning,
        overall: checks.overall,
      })
    } else {
      logger.info("Security checks passed", {
        overall: checks.overall,
      })
    }
  }
}

/**
 * Security utilities
 */
export const securityCheck = {
  run: runSecurityChecks,
  log: logSecurityChecks,
}
