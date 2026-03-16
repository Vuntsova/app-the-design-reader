/**
 * Structured Logging System
 *
 * Provides consistent logging across the app with:
 * - Multiple log levels (debug, info, warn, error)
 * - Contextual logging with metadata
 * - Automatic sensitive data redaction
 * - Environment-aware behavior
 * - Integration with analytics and crash reporting
 */

// Lazy imports to avoid circular dependencies
// These are imported only when needed, not at module load time

/**
 * Log levels
 */
export enum LogLevel {
  TRACE = "TRACE",
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

/**
 * Log level priority for filtering
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  [LogLevel.TRACE]: 0,
  [LogLevel.DEBUG]: 1,
  [LogLevel.INFO]: 2,
  [LogLevel.WARN]: 3,
  [LogLevel.ERROR]: 4,
}

/**
 * Sensitive data patterns for key names
 */
const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /api[_-]?key/i,
  /credit[_-]?card/i,
  /ssn/i,
  /social[_-]?security/i,
  /email/i, // Email addresses in keys
  /auth[_-]?token/i,
  /access[_-]?token/i,
  /refresh[_-]?token/i,
  /session[_-]?id/i,
  /authorization/i,
  /bearer/i,
]

/**
 * Sensitive value patterns (for value-based redaction)
 */
const SENSITIVE_VALUE_PATTERNS = [
  // JWT tokens (eyJ...)
  /^eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*$/,
  // Email addresses
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  // API keys (long alphanumeric strings)
  /^[A-Za-z0-9_-]{32,}$/,
  // Credit card numbers (13-19 digits)
  /^\d{13,19}$/,
  // SSN (XXX-XX-XXXX or XXXXXXXXX)
  /^\d{3}-?\d{2}-?\d{4}$/,
]

/**
 * Check if a key contains sensitive data
 */
function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key))
}

/**
 * Check if a value contains sensitive data
 */
function isSensitiveValue(value: unknown): boolean {
  if (typeof value !== "string") {
    return false
  }

  // Check if value matches any sensitive pattern
  return SENSITIVE_VALUE_PATTERNS.some((pattern) => pattern.test(value))
}

/**
 * Redact sensitive data from a string (for message strings)
 */
function redactSensitiveString(str: string): string {
  let redacted = str

  // Redact JWT tokens
  redacted = redacted.replace(
    /eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g,
    "[REDACTED_TOKEN]",
  )

  // Redact email addresses (but preserve format for debugging)
  redacted = redacted.replace(
    /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    (match, local, domain) => {
      // Show first char and last char of local, full domain
      const maskedLocal = local.length > 2 ? `${local[0]}***${local[local.length - 1]}` : "***"
      return `${maskedLocal}@${domain}`
    },
  )

  // Redact long alphanumeric strings (potential API keys)
  redacted = redacted.replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[REDACTED_KEY]")

  // Redact credit card numbers
  redacted = redacted.replace(/\b\d{13,19}\b/g, "[REDACTED_CARD]")

  // Redact SSN
  redacted = redacted.replace(/\b\d{3}-?\d{2}-?\d{4}\b/g, "[REDACTED_SSN]")

  return redacted
}

/**
 * Redact sensitive data from values
 */
function redactSensitiveValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value
  }

  if (typeof value === "string") {
    if (isSensitiveValue(value)) {
      if (/^eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*$/.test(value)) {
        return `${value.substring(0, 10)}...[REDACTED]`
      }
      if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)) {
        const [local, domain] = value.split("@")
        const maskedLocal = local.length > 2 ? `${local[0]}***${local[local.length - 1]}` : "***"
        return `${maskedLocal}@${domain}`
      }
      return "[REDACTED]"
    }
    return value
  }

  if (Array.isArray(value)) {
    return value.map(redactSensitiveValue)
  }

  if (typeof value === "object") {
    return redactSensitiveData(value as Record<string, unknown>)
  }

  return value
}

/**
 * Redact sensitive data from an object
 */
function redactSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(data)) {
    if (isSensitiveKey(key)) {
      redacted[key] = "[REDACTED]"
    } else if (typeof value === "string" && isSensitiveValue(value)) {
      redacted[key] = redactSensitiveValue(value)
    } else {
      redacted[key] = redactSensitiveValue(value)
    }
  }

  return redacted
}

/**
 * Format log message with metadata
 */
function formatLogMessage(
  level: LogLevel,
  message: string,
  metadata?: Record<string, unknown>,
): string {
  const timestamp = new Date().toISOString()
  const metadataStr = metadata ? ` ${JSON.stringify(metadata)}` : ""
  return `[${timestamp}] [${level}] ${message}${metadataStr}`
}

/**
 * Logger configuration
 */
interface LoggerConfig {
  minLevel: LogLevel
  enableConsole: boolean
  enableAnalytics: boolean
  enableCrashReporting: boolean
  redactSensitiveData: boolean
}

/**
 * Main Logger class
 */
class Logger {
  private config: LoggerConfig

  constructor() {
    // Default configuration based on environment
    this.config = {
      minLevel: __DEV__ ? LogLevel.DEBUG : LogLevel.INFO,
      enableConsole: true,
      enableAnalytics: !__DEV__,
      enableCrashReporting: !__DEV__,
      redactSensitiveData: true,
    }
  }

  /**
   * Update logger configuration
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Check if a log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.config.minLevel]
  }

  /**
   * Prepare metadata for logging
   */
  private prepareMetadata(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!metadata) return undefined

    return this.config.redactSensitiveData ? redactSensitiveData(metadata) : metadata
  }

  /**
   * Prepare message string for logging (redact sensitive data in messages)
   */
  private prepareMessage(message: string): string {
    if (!this.config.redactSensitiveData) return message
    return redactSensitiveString(message)
  }

  /**
   * Log to console
   */
  private logToConsole(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
    if (!this.config.enableConsole) return

    const safeMessage = this.prepareMessage(message)
    const formattedMessage = formatLogMessage(level, safeMessage, metadata)

    switch (level) {
      case LogLevel.TRACE:
        console.debug(formattedMessage)
        break
      case LogLevel.DEBUG:
        console.debug(formattedMessage)
        break
      case LogLevel.INFO:
        console.info(formattedMessage)
        break
      case LogLevel.WARN:
        console.warn(formattedMessage)
        break
      case LogLevel.ERROR:
        console.error(formattedMessage)
        break
    }
  }

  /**
   * Log to analytics
   */
  private logToAnalytics(
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>,
  ): void {
    if (!this.config.enableAnalytics) return

    // Only track warnings and errors to analytics
    if (level === LogLevel.WARN || level === LogLevel.ERROR) {
      // Lazy import to avoid circular dependency
      try {
        const { trackEvent } = require("./analytics")
        trackEvent(`log_${level.toLowerCase()}`, {
          message,
          ...metadata,
        })
      } catch (error) {
        // Silently fail if analytics module is not available (e.g., during circular dependency resolution)
        if (__DEV__) {
          console.warn("Failed to log to analytics:", error)
        }
      }
    }
  }

  /**
   * Log to crash reporting
   */
  private logToCrashReporting(
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>,
    error?: Error,
  ): void {
    if (!this.config.enableCrashReporting) return

    // Only report errors to crash reporting
    if (level === LogLevel.ERROR) {
      // Lazy import to avoid circular dependency
      try {
        const { captureException, captureMessage } = require("./crashReporting")
        if (error) {
          captureException(error, {
            tags: { level },
            extra: { message, ...metadata },
          })
        } else {
          captureMessage(message, {
            level: "error",
            extra: metadata,
          })
        }
      } catch (err) {
        // Silently fail if crash reporting module is not available (e.g., during circular dependency resolution)
        if (__DEV__) {
          console.warn("Failed to log to crash reporting:", err)
        }
      }
    }
  }

  /**
   * Core logging method
   */
  private log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>,
    error?: Error,
  ): void {
    if (!this.shouldLog(level)) return

    const safeMessage = this.prepareMessage(message)
    const preparedMetadata = this.prepareMetadata(metadata)

    this.logToConsole(level, safeMessage, preparedMetadata)
    this.logToAnalytics(level, safeMessage, preparedMetadata)
    this.logToCrashReporting(level, safeMessage, preparedMetadata, error)
  }

  /**
   * Trace level logging (most verbose)
   */
  trace(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.TRACE, message, metadata)
  }

  /**
   * Debug level logging
   */
  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, metadata)
  }

  /**
   * Info level logging
   */
  info(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, metadata)
  }

  /**
   * Warning level logging
   */
  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, metadata)
  }

  /**
   * Error level logging
   */
  error(message: string, metadata?: Record<string, unknown>, error?: Error): void {
    this.log(LogLevel.ERROR, message, metadata, error)
  }

  /**
   * Create a child logger with additional context
   */
  child(context: Record<string, unknown>): Logger {
    const childLogger = new Logger()
    childLogger.config = { ...this.config }

    // Override log method to include context
    const originalLog = childLogger.log.bind(childLogger)
    childLogger.log = (
      level: LogLevel,
      message: string,
      metadata?: Record<string, unknown>,
      error?: Error,
    ) => {
      originalLog(level, message, { ...context, ...metadata }, error)
    }

    return childLogger
  }

  /**
   * Create a scoped logger for a specific module
   */
  scope(moduleName: string): Logger {
    return this.child({ module: moduleName })
  }
}

// Export singleton instance
export const logger = new Logger()

/**
 * Create a scoped logger for a module
 */
export function createLogger(moduleName: string): Logger {
  return logger.scope(moduleName)
}

/**
 * Utility to measure and log execution time
 */
export async function measureExecutionTime<T>(
  operation: () => Promise<T>,
  operationName: string,
  metadata?: Record<string, unknown>,
): Promise<T> {
  const startTime = Date.now()

  try {
    const result = await operation()
    const duration = Date.now() - startTime

    logger.debug(`${operationName} completed`, {
      duration,
      ...metadata,
    })

    return result
  } catch (error) {
    const duration = Date.now() - startTime

    logger.error(
      `${operationName} failed`,
      {
        duration,
        ...metadata,
      },
      error as Error,
    )

    throw error
  }
}
