#!/usr/bin/env node

import fs from "fs"
import path from "path"
import https from "https"
import { execSync } from "child_process"
import inquirer from "inquirer"
import ora from "ora"
import chalk from "chalk"
import boxen from "boxen"

type EnvVars = Record<string, string>
type EnvFileComment = { line: number; content: string }
type EnvFileData = { vars: EnvVars; comments: EnvFileComment[]; lines: string[]; originalContent?: string }
type PrerequisiteCheck = {
  name: string
  command: string
  minVersion: string
  check: (version: string) => boolean
}
type SetupOptions = { skipConfirm?: boolean }
type MetadataConfig = {
  displayName: string
  projectName: string
  bundleId: string
  scheme: string
}

// ========================================
// CONSTANTS
// ========================================
const MIN_NODE_VERSION = "20.0.0"
const MIN_YARN_VERSION = "4.0.0"
const BACKUP_DIR = path.join(__dirname, ".setup-backups")

// ========================================
// VERSION HELPERS
// ========================================
const parseSemver = (value: string): [number, number, number] | null => {
  const match = value.match(/v?(\d+)\.(\d+)\.(\d+)/)
  if (!match) return null
  return [Number.parseInt(match[1], 10), Number.parseInt(match[2], 10), Number.parseInt(match[3], 10)]
}

const isVersionAtLeast = (value: string, minimum: string): boolean => {
  const current = parseSemver(value)
  const target = parseSemver(minimum)
  if (!current || !target) return false
  for (let i = 0; i < 3; i += 1) {
    if (current[i] > target[i]) return true
    if (current[i] < target[i]) return false
  }
  return true
}

// ========================================
// HELPER FUNCTIONS
// ========================================

// Check if running in non-interactive mode
const isNonInteractive = process.env.CI === "true" || process.argv.includes("--non-interactive")
const isHelpRequested = process.argv.includes("--help") || process.argv.includes("-h")

// Show help and exit
if (isHelpRequested) {
  console.log(`
🚀 Shipnative Setup Script

Usage:
  yarn setup [options]

Options:
  --help, -h              Show this help message
  --non-interactive       Run in non-interactive mode (uses env vars)
  --skip-prereqs          Skip prerequisite checks
  --skip-backup           Skip creating backups
  --validate-services     Test service connectivity after configuration
  --dry-run               Preview changes without applying them

Examples:
  yarn setup                                    # Interactive setup wizard
  yarn setup --non-interactive                 # CI/CD mode
  yarn setup --validate-services                # Test services after setup
  yarn setup --dry-run                          # Preview changes

For more information, visit: https://docs.shipnative.app
`)
  process.exit(0)
}

// Inquirer is ready to use for interactive prompts

// ========================================
// PREREQUISITES CHECK
// ========================================
const checkPrerequisites = async (skipCheck = false): Promise<boolean> => {
  if (skipCheck || process.argv.includes("--skip-prereqs")) {
    return true
  }

  const spinner = ora("Checking prerequisites").start()

  const checks: PrerequisiteCheck[] = [
    {
      name: "Node.js",
      command: "node --version",
      minVersion: MIN_NODE_VERSION,
      check: (version) => isVersionAtLeast(version, MIN_NODE_VERSION),
    },
    {
      name: "Yarn",
      command: "yarn --version",
      minVersion: MIN_YARN_VERSION,
      check: (version) => isVersionAtLeast(version, MIN_YARN_VERSION),
    },
  ]

  let allPassed = true
  const results = []

  for (const check of checks) {
    try {
      const output = execSync(check.command, { encoding: "utf8", stdio: "pipe" }).trim()
      const version = output.split("\n")[0]
      const passed = check.check(version)
      results.push({ name: check.name, version, passed, minVersion: check.minVersion })
      if (!passed) allPassed = false
    } catch (error) {
      results.push({ name: check.name, version: null, passed: false, minVersion: check.minVersion })
      allPassed = false
    }
  }

  spinner.stop()

  // Display results with colors
  console.log("\n" + chalk.bold.cyan("🔍 Prerequisites Check\n"))
  for (const result of results) {
    if (result.passed) {
      console.log(chalk.green(`   ✅ ${result.name}: ${chalk.dim(result.version)}`))
    } else {
      const installLink = result.name === "Node.js" ? "https://nodejs.org/" : "npm install -g yarn"
      console.log(chalk.red(`   ❌ ${result.name}: ${result.version || "Not found"} ${chalk.dim(`(requires ${result.minVersion}+)`)}`))
      console.log(chalk.dim(`      Install: ${installLink}`))
    }
  }

  if (!allPassed) {
    console.log(chalk.red("\n❌ Prerequisites check failed. Please install required tools and try again."))
    console.log(chalk.dim("   Or run with --skip-prereqs to continue anyway.\n"))
    process.exit(1)
  } else {
    console.log("")
  }

  return allPassed
}

// ========================================
// BACKUP FUNCTIONALITY
// ========================================
const ensureBackupDir = (): void => {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
  }
}

const backupFile = (filePath: string, skipBackup = false): string | null => {
  if (skipBackup || process.argv.includes("--skip-backup")) {
    return null
  }

  if (!fs.existsSync(filePath)) {
    return null
  }

  try {
    ensureBackupDir()
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const fileName = path.basename(filePath)
    const backupPath = path.join(BACKUP_DIR, `${fileName}.${timestamp}.backup`)

    fs.copyFileSync(filePath, backupPath)
    return backupPath
  } catch (error) {
    console.warn(`   ⚠️  Could not create backup for ${filePath}: ${error.message}`)
    return null
  }
}

// ========================================
// PROGRESS INDICATORS
// ========================================
const createSpinner = (message: string): ((success?: boolean) => void) => {
  if (isNonInteractive) {
    process.stdout.write(`${message}... `)
    return (success = true) => {
      process.stdout.write(`${success ? "✅" : "❌"}\n`)
    }
  }

  const spinner = ora(message).start()
  return (success = true) => {
    if (success) {
      spinner.succeed(message)
    } else {
      spinner.fail(message)
    }
  }
}

// ========================================
// ERROR HANDLING
// ========================================
const handleError = (
  error: { code?: string; name?: string; message?: string; stack?: string },
  context: { file?: string; step?: string; suggestion?: string } = {}
) => {
  const errorMessages = {
    ENOENT: `File not found: ${context.file || "unknown"}. Make sure you're running from the project root.`,
    EACCES: `Permission denied: ${context.file || "unknown"}. Check file permissions.`,
    JSON: `Invalid JSON in ${context.file || "unknown"}. Please check the file format.`,
  }

  const code = error.code || error.name
  const message = errorMessages[code] || error.message || "Unknown error occurred"

  console.error(chalk.red(`\n❌ Error in ${context.step || "setup"}: ${message}`))
  if (context.suggestion) {
    console.error(chalk.yellow(`💡 Suggestion: ${context.suggestion}`))
  }
  if (error.stack && process.env.DEBUG) {
    console.error(chalk.dim("\nStack trace:"), error.stack)
  }
}

// ========================================
// ENV FILE HANDLING (WITH COMMENTS)
// ========================================
const loadEnvFileWithComments = (filePath: string): EnvFileData => {
  if (!fs.existsSync(filePath)) {
    return { vars: {}, comments: [], lines: [] }
  }

  const content = fs.readFileSync(filePath, "utf8")
  const lines = content.split(/\r?\n/)
  const vars = {}
  const comments = []

  lines.forEach((line, index) => {
    const trimmed = line.trim()
    if (trimmed.startsWith("#")) {
      comments.push({ line: index, content: trimmed })
    } else if (trimmed && trimmed.includes("=")) {
      const delimiterIndex = trimmed.indexOf("=")
      const key = trimmed.slice(0, delimiterIndex).trim()
      const value = trimmed.slice(delimiterIndex + 1).trim()
      if (key) {
        vars[key] = value
      }
    }
  })

  return { vars, comments, lines, originalContent: content }
}

// Helper to format env value - quotes multi-line values properly
const formatEnvValue = (value: string): string => {
  // If value contains newlines, wrap in double quotes and escape internal quotes
  if (value.includes("\n")) {
    const escaped = value.replace(/"/g, '\\"')
    return `"${escaped}"`
  }
  // If value contains special characters that might cause issues, quote it
  if (value.includes(" ") || value.includes("#") || value.includes("'")) {
    return `"${value.replace(/"/g, '\\"')}"`
  }
  return value
}

const writeEnvFileWithComments = (filePath: string, values: EnvVars, originalData: EnvFileData | null = null) => {
  const lines = originalData?.lines || []
  const newLines = []

  // Track which keys we've written
  const writtenKeys = new Set()

  // First, preserve existing structure and comments
  if (originalData) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()

      if (trimmed.startsWith("#")) {
        // Preserve comments
        newLines.push(line)
      } else if (trimmed.includes("=")) {
        const key = trimmed.slice(0, trimmed.indexOf("=")).trim()
        if (values[key] !== undefined) {
          // Update existing value with proper formatting
          newLines.push(`${key}=${formatEnvValue(values[key])}`)
          writtenKeys.add(key)
        } else {
          // Keep existing line if not in new values
          newLines.push(line)
        }
      } else if (trimmed === "") {
        // Preserve empty lines
        newLines.push("")
      }
    }
  }

  // Add new keys that weren't in the original file
  for (const [key, value] of Object.entries(values)) {
    if (!writtenKeys.has(key)) {
      newLines.push(`${key}=${formatEnvValue(value)}`)
    }
  }

  const content = newLines.join("\n")
  fs.writeFileSync(filePath, content ? `${content}\n` : "")
}

// Legacy function for backward compatibility
const loadEnvFile = (filePath: string): EnvVars => {
  return loadEnvFileWithComments(filePath).vars
}

const writeEnvFile = (filePath: string, values: EnvVars) => {
  const originalData = loadEnvFileWithComments(filePath)
  writeEnvFileWithComments(filePath, values, originalData)
}

// ========================================
// INPUT HELPERS (Using Inquirer)
// ========================================
const askQuestion = async (
  question: string,
  validator?: (value: string) => boolean,
  defaultValue?: string,
  isSecret = false
): Promise<string> => {
  if (isNonInteractive) {
    // In non-interactive mode, try to get from env or use default
    const envKey = question.toUpperCase().replace(/[^A-Z0-9]/g, "_")
    const envValue = process.env[envKey] || defaultValue || ""
    if (validator && !validator(envValue)) {
      throw new Error(`Invalid value for ${question} from environment`)
    }
    return envValue
  }

  const message = defaultValue ? `${question} ${chalk.dim(`(default: ${defaultValue})`)}` : question

  const answer = await inquirer.prompt([
    {
      type: isSecret ? "password" : "input",
      name: "value",
      message,
      default: defaultValue,
      validate: (input) => {
        const value = input.trim() || defaultValue || ""
        if (validator && !validator(value)) {
          // Provide helpful error messages based on the question
          if (message.toLowerCase().includes("bundle identifier")) {
            return chalk.red("❌ Bundle identifier must be in format: com.company.appname (lowercase, dots, no spaces)")
          }
          if (message.toLowerCase().includes("scheme")) {
            return chalk.red("❌ App scheme must be lowercase letters/numbers only (no spaces or special characters)")
          }
          if (message.toLowerCase().includes("project name")) {
            return chalk.red("❌ Project name must be lowercase, numbers, and dashes only (e.g., my-awesome-app)")
          }
          if (message.toLowerCase().includes("redirect url")) {
            return chalk.red("❌ Please enter a valid URL or deep link (e.g., shipnative://verify-email or https://example.com)")
          }
          if (message.toLowerCase().includes("url")) {
            return chalk.red("❌ Please enter a valid URL starting with https://")
          }
          return chalk.red("❌ Invalid input. Please check the format and try again.")
        }
        return true
      },
    },
  ])

  return answer.value.trim() || defaultValue || ""
}

const askYesNo = async (question: string, defaultValue = true): Promise<boolean> => {
  if (isNonInteractive) {
    const envKey = question.toUpperCase().replace(/[^A-Z0-9]/g, "_")
    const envValue = process.env[envKey]
    if (envValue) {
      return envValue.toLowerCase() === "y" || envValue.toLowerCase() === "yes" || envValue === "true"
    }
    return defaultValue
  }

  const answer = await inquirer.prompt([
    {
      type: "confirm",
      name: "value",
      message: question,
      default: defaultValue,
    },
  ])

  return answer.value
}

const askChoice = async (
  question: string,
  options: Array<{ value: string; label: string }>,
  defaultValue?: string
): Promise<string> => {
  if (isNonInteractive) {
    return defaultValue || options[0]?.value
  }

  const defaultIndex =
    defaultValue != null ? options.findIndex((option) => option.value === defaultValue) : 0

  const answer = await inquirer.prompt([
    {
      type: "list",
      name: "value",
      message: question,
      choices: options.map((opt) => ({
        name: opt.label,
        value: opt.value,
      })),
      default: defaultIndex >= 0 ? options[defaultIndex].value : undefined,
    },
  ])

  return answer.value
}

const askMultiChoice = async (
  question: string,
  options: Array<{ value: string; label: string; checked?: boolean }>,
): Promise<string[]> => {
  if (isNonInteractive) {
    // In non-interactive mode, return all pre-checked options
    return options.filter(opt => opt.checked).map(opt => opt.value)
  }

  const answer = await inquirer.prompt([
    {
      type: "checkbox",
      name: "values",
      message: question,
      choices: options.map((opt) => ({
        name: opt.label,
        value: opt.value,
        checked: opt.checked ?? false,
      })),
    },
  ])

  return answer.values
}

// ========================================
// VALIDATORS (IMPROVED)
// ========================================
const validateBundleId = (bundleId: string) => /^[a-zA-Z0-9-.]+$/.test(bundleId)
const validateScheme = (scheme: string) => /^[a-z0-9]+$/.test(scheme)
const validateUrl = (url: string) => {
  if (!url) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === "https:"
  } catch {
    return false
  }
}
const validateUrlOrDeepLink = (url: string) => {
  if (!url) return false
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}
const validateNotEmpty = (value: string) => value.length > 0
const validateSupabaseKey = (key: string) => {
  if (!key) return false
  // New format: sb_publishable_...
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true
  // Legacy JWT format: eyJ...
  if (/^eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)) return true
  // Fallback: at least 20 characters
  return key.length >= 20
}
const validatePostHogKey = (key: string) => {
  if (!key) return true // Allow empty to skip
  // PostHog keys are typically 32+ character alphanumeric strings
  return /^[A-Za-z0-9_-]{20,}$/.test(key)
}
const validateConvexUrl = (url: string) => {
  if (!url) return false
  try {
    const parsed = new URL(url)
    // Convex URLs are typically https://*.convex.cloud
    return parsed.protocol === "https:" && (parsed.hostname.endsWith(".convex.cloud") || parsed.hostname.includes("convex"))
  } catch {
    return false
  }
}
const validateSentryDSN = (dsn: string) => {
  if (!dsn) return true // Allow empty to skip
  // Sentry DSN format: https://[key]@[host]/[project-id]
  return /^https:\/\/[A-Za-z0-9]+@[A-Za-z0-9.-]+\/[0-9]+$/.test(dsn)
}

// ========================================
// SECURITY WARNINGS
// ========================================
const checkGitIgnore = (filePath: string) => {
  const gitignorePath = path.join(__dirname, ".gitignore")
  if (!fs.existsSync(gitignorePath)) {
    return false
  }

  const gitignore = fs.readFileSync(gitignorePath, "utf8")
  const relativePath = path.relative(__dirname, filePath)
  return gitignore.includes(relativePath) || gitignore.includes(path.basename(filePath))
}

const warnAboutEnvSecurity = (envPath: string) => {
  if (isNonInteractive) return

  console.log(chalk.yellow("\n🔒 Security Reminder:"))
  console.log(chalk.dim("   • EXPO_PUBLIC_* variables are BUNDLED into your app and visible to users"))
  console.log(chalk.dim("   • Never commit .env files to version control"))
  console.log(chalk.dim("   • Use Row Level Security (RLS) in Supabase to protect data"))

  if (!checkGitIgnore(envPath)) {
    console.warn(chalk.yellow(`\n   ⚠️  Warning: ${path.basename(envPath)} may not be in .gitignore`))
    console.warn(chalk.yellow("   Make sure to add it to prevent committing secrets!"))
  }
}

// ========================================
// SERVICE VALIDATION
// ========================================
const validateSupabaseConnection = async (url: string, key: string): Promise<boolean> => {
  try {
    const stopSpinner = createSpinner("Testing Supabase connection")
    const urlObj = new URL(url)
    
    return new Promise((resolve) => {
      const options = {
        hostname: urlObj.hostname,
        port: 443,
        path: "/rest/v1/",
        method: "GET",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
        timeout: 5000,
      }

      const req = https.request(options, (res) => {
        stopSpinner(res.statusCode >= 200 && res.statusCode < 300)
        resolve(res.statusCode >= 200 && res.statusCode < 300)
      })

      req.on("error", () => {
        stopSpinner(false)
        resolve(false)
      })

      req.on("timeout", () => {
        req.destroy()
        stopSpinner(false)
        resolve(false)
      })

      req.end()
    })
  } catch (error) {
    return false
  }
}

// ========================================
// UTILITY HELPERS
// ========================================
const repeatLine = (char = "━"): string => char.repeat(70)
const printSection = (title: string, descriptionLines: string[] = []) => {
  console.log("")
  const boxContent = [
    chalk.bold.cyan(title),
    ...(descriptionLines.length > 0 ? ["", ...descriptionLines.map((line) => chalk.dim(line))] : []),
  ].join("\n")
  console.log(boxen(boxContent, { padding: 1, borderColor: "cyan", borderStyle: "round" }))
  console.log("")
}

const getMetadataDefaults = (): Partial<MetadataConfig> => {
  const appJsonPath = path.join(__dirname, "apps/app/app.json")
  if (!fs.existsSync(appJsonPath)) return {}

  try {
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf8"))
    const configRoot = appJson.expo || appJson
    return {
      displayName: configRoot.name,
      projectName: configRoot.slug,
      bundleId: configRoot?.ios?.bundleIdentifier,
      scheme: configRoot.scheme || configRoot.slug,
    }
  } catch (error) {
    console.warn(chalk.yellow("⚠️ Could not read existing app.json for defaults:"), error.message)
    return {}
  }
}

// ========================================
// BACKEND CLEANUP (Remove unused provider code)
// ========================================

const removeUnusedBackendCode = async (selectedProvider: BackendProvider): Promise<boolean> => {
  const unusedProvider = selectedProvider === "supabase" ? "convex" : "supabase"

  // Paths to clean up (directories)
  const pathsToRemove = [
    // Service layer
    `apps/app/app/services/backend/${unusedProvider}`,
    // Hooks
    `apps/app/app/hooks/${unusedProvider}`,
    // Auth store - backend-specific directory
    `apps/app/app/stores/auth/${unusedProvider}`,
    // Auth store - root-level __tests__ (tests now in supabase/__tests__)
    `apps/app/app/stores/auth/__tests__`,
  ]

  // Files to remove (individual files)
  const filesToRemove: string[] = []

  // Additional Convex-specific paths (when removing Convex)
  if (unusedProvider === "convex") {
    pathsToRemove.push(
      "packages/backend/convex",
      "convex", // Root convex folder
    )
    // Also remove Convex provider files and convex-specific screen/component files
    filesToRemove.push(
      "apps/app/app/providers/ConvexProvider.tsx",
      "apps/app/app/providers/ConvexAuthSync.tsx",
      // Convex-specific screens and components
      "apps/app/app/screens/ProfileScreen.convex.tsx",
      "apps/app/app/screens/ResetPasswordScreen.convex.tsx",
      "apps/app/app/screens/DataDemoScreen.convex.tsx",
      "apps/app/app/components/EditProfileModal.convex.tsx",
      "apps/app/app/services/widgets.convex.ts",
      // Root-level auth store files (replaced by supabase/ subdirectory)
      "apps/app/app/stores/auth/authStore.ts",
      "apps/app/app/stores/auth/authActions.ts",
      "apps/app/app/stores/auth/authHelpers.ts",
    )
  }

  // Additional Supabase-specific paths (when removing Supabase)
  if (unusedProvider === "supabase") {
    // Remove Supabase provider files
    filesToRemove.push(
      "apps/app/app/providers/SupabaseProvider.tsx",
      "apps/app/app/providers/SupabaseAuthSync.tsx",
      // Supabase-specific screens and components
      "apps/app/app/screens/ProfileScreen.supabase.tsx",
      "apps/app/app/screens/ResetPasswordScreen.supabase.tsx",
      "apps/app/app/screens/DataDemoScreen.supabase.tsx",
      "apps/app/app/components/EditProfileModal.supabase.tsx",
      "apps/app/app/services/widgets.supabase.ts",
      // Supabase service files (these have direct @supabase/supabase-js imports)
      "apps/app/app/services/supabase.ts",
      "apps/app/app/services/api/index.ts",
      "apps/app/app/services/accountDeletion.ts", // Has Supabase imports - Convex uses mutations instead
      "apps/app/app/services/preferencesSync.ts", // Has Supabase imports - Convex uses mutations instead
      // Root-level auth store files (replaced by convex/ subdirectory)
      "apps/app/app/stores/auth/authStore.ts",
      "apps/app/app/stores/auth/authActions.ts",
      "apps/app/app/stores/auth/authHelpers.ts",
      // Supabase types
      "apps/app/app/types/supabase.ts",
      "apps/app/app/types/supabaseErrors.ts",
      "apps/app/app/types/auth.ts",
      // Supabase hooks
      "apps/app/app/hooks/useAuth.ts",
      // Supabase mocks folder
      "apps/app/app/services/mocks/supabase",
      // Test files
      "apps/app/app/services/__tests__/supabase.test.ts",
      "apps/app/app/services/__tests__/api.test.ts", // Depends on api which is Supabase-specific
      // Note: stores/auth/__tests__ directory is deleted in pathsToRemove
      // Supabase-specific context (uses supabase imports directly)
      "apps/app/app/context/AuthContext.tsx",
      // EpisodeContext depends on api which depends on supabase - demo file
      "apps/app/app/context/EpisodeContext.tsx",
      // Integration tests that depend on Supabase services
      "apps/app/app/__tests__/integration/authFlow.test.tsx",
      "apps/app/app/__tests__/integration/notificationFlow.test.tsx",
      // Entire api directory (depends on supabase)
      "apps/app/app/services/api",
    )
  }

  // Check which paths exist
  const existingPaths = pathsToRemove
    .map(p => path.join(__dirname, p))
    .filter(p => fs.existsSync(p))

  const existingFiles = filesToRemove
    .map(p => path.join(__dirname, p))
    .filter(p => fs.existsSync(p))

  if (existingPaths.length === 0 && existingFiles.length === 0) {
    return false // Nothing to clean up
  }

  // Auto-cleanup: no prompt, just do it
  console.log(chalk.cyan(`\n🧹 Cleaning up unused ${unusedProvider} code...`))
  if (existingPaths.length > 0) {
    console.log(chalk.dim("   Removing folders:"))
    for (const p of existingPaths) {
      console.log(chalk.dim(`   • ${path.relative(__dirname, p)}/`))
    }
  }
  if (existingFiles.length > 0) {
    console.log(chalk.dim("   Removing files:"))
    for (const p of existingFiles) {
      console.log(chalk.dim(`   • ${path.relative(__dirname, p)}`))
    }
  }

  const stopSpinner = createSpinner(`Removing ${unusedProvider} backend code`)

  try {
    // Remove directories
    for (const fullPath of existingPaths) {
      // Remove directory recursively (no backup needed - they can re-clone if needed)
      fs.rmSync(fullPath, { recursive: true, force: true })
    }

    // Remove individual files (some entries may be directories, so use recursive)
    for (const fullPath of existingFiles) {
      fs.rmSync(fullPath, { recursive: true, force: true })
    }

    // Update source files to remove unused backend references
    if (unusedProvider === "convex") {
      // Removing Convex, keeping Supabase
      updateProvidersIndex(selectedProvider)
      updateBackendProviderImports(selectedProvider)
      updateBackendServiceIndex(selectedProvider)
      updateConditionalExports(selectedProvider)
    } else if (unusedProvider === "supabase") {
      // Removing Supabase, keeping Convex
      updateProvidersIndexForConvex(selectedProvider)
      updateBackendProviderImportsForConvex(selectedProvider)
      updateBackendServiceIndexForConvex(selectedProvider)
      updateConditionalExportsForConvex(selectedProvider)
    }

    stopSpinner(true)
    console.log(chalk.green(`✅ Removed ${unusedProvider} code. Your codebase is now ${selectedProvider}-only!`))
    return true
  } catch (error) {
    stopSpinner(false)
    console.error(chalk.red(`\n❌ Failed to remove some files: ${error.message}`))
    console.log(chalk.yellow("   You can manually remove these folders later."))
    return false
  }
}

// Update providers/index.ts to remove Convex exports when using Supabase
const updateProvidersIndex = (selectedProvider: BackendProvider): void => {
  const indexPath = path.join(__dirname, "apps/app/app/providers/index.ts")
  if (!fs.existsSync(indexPath)) return

  try {
    let content = fs.readFileSync(indexPath, "utf8")

    if (selectedProvider === "supabase") {
      // Remove Convex-related exports
      content = content.replace(
        /\n\/\/ Native providers for direct use\nexport \{ ConvexProvider, getConvexClient, destroyConvexClient \} from "\.\/ConvexProvider"\nexport \{ ConvexAuthSync \} from "\.\/ConvexAuthSync"\n/,
        "\n"
      )
      // Also try alternative patterns
      content = content.replace(
        /export \{ ConvexProvider, getConvexClient, destroyConvexClient \} from "\.\/ConvexProvider"\n/g,
        ""
      )
      content = content.replace(
        /export \{ ConvexAuthSync \} from "\.\/ConvexAuthSync"\n/g,
        ""
      )
    }

    fs.writeFileSync(indexPath, content)
    console.log(chalk.dim(`   • Updated providers/index.ts`))
  } catch (error) {
    console.warn(chalk.yellow(`   ⚠️ Could not update providers/index.ts: ${error.message}`))
  }
}

// Update BackendProvider.tsx to remove Convex imports when using Supabase
const updateBackendProviderImports = (selectedProvider: BackendProvider): void => {
  const providerPath = path.join(__dirname, "apps/app/app/providers/BackendProvider.tsx")
  if (!fs.existsSync(providerPath)) return

  try {
    const content = fs.readFileSync(providerPath, "utf8")
    const lines = content.split("\n")
    const newLines: string[] = []

    if (selectedProvider === "supabase") {
      let skipUntilClosingBrace = false
      let braceDepth = 0

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]

        // Skip import lines for Convex
        if (line.includes('from "../providers/ConvexAuthSync"') ||
            line.includes('from "./ConvexAuthSync"') ||
            line.includes('from "../providers/ConvexProvider"') ||
            line.includes('from "./ConvexProvider"')) {
          continue
        }

        // Skip the ConvexProviderWrapper function definition
        if (line.includes("function ConvexProviderWrapper")) {
          skipUntilClosingBrace = true
          braceDepth = 0
        }

        if (skipUntilClosingBrace) {
          braceDepth += (line.match(/\{/g) || []).length
          braceDepth -= (line.match(/\}/g) || []).length
          if (braceDepth <= 0 && line.trim() === "}") {
            skipUntilClosingBrace = false
          }
          continue
        }

        // Skip the "// Convex Provider" section header (3 lines before the function)
        if (line.includes("// Convex Provider") && line.includes("====")) {
          // Skip the comment block (this line and next 2)
          i += 2
          continue
        }

        // Skip the isConvex conditional
        if (line.includes("if (isConvex)")) {
          // Skip this line and the next 2 lines (return statement and closing brace)
          i += 2
          continue
        }

        // Update the env import to remove isConvex
        if (line.includes("isSupabase, isConvex") && line.includes("from")) {
          newLines.push(line.replace("isSupabase, isConvex", "isSupabase"))
          continue
        }

        // Skip ConvexProviderWrapper JSX usage (opening and closing tags)
        if (line.includes("<ConvexProviderWrapper>") || line.includes("</ConvexProviderWrapper>")) {
          continue
        }

        // Skip comments about "both providers" that become misleading when only using Supabase
        if (line.includes("Always wrap with both providers") ||
            line.includes("React's rules of hooks require") ||
            line.includes("The unused provider will be a no-op")) {
          continue
        }

        newLines.push(line)
      }

      fs.writeFileSync(providerPath, newLines.join("\n"))
      console.log(chalk.dim(`   • Updated BackendProvider.tsx`))
    }
  } catch (error) {
    console.warn(chalk.yellow(`   ⚠️ Could not update BackendProvider.tsx: ${error.message}`))
  }
}

// Update services/backend/index.ts to remove Convex references when using Supabase
const updateBackendServiceIndex = (selectedProvider: BackendProvider): void => {
  const indexPath = path.join(__dirname, "apps/app/app/services/backend/index.ts")
  if (!fs.existsSync(indexPath)) return

  try {
    let content = fs.readFileSync(indexPath, "utf8")

    if (selectedProvider === "supabase") {
      // Remove isConvex from imports
      content = content.replace(/isSupabase, isConvex/g, "isSupabase")
      content = content.replace(/, isConvex/g, "")

      // Remove the "else if (isConvex)" blocks with their content - async version
      content = content.replace(
        /\} else if \(isConvex\) \{\s*\/\/ Dynamically import Convex backend\s*const \{ createConvexBackend \} = await import\("\.\/convex"\)\s*backendInstance = createConvexBackend\(\)\s*\}/g,
        "}"
      )

      // Remove the "else if (isConvex)" blocks with their content - sync version
      content = content.replace(
        /\} else if \(isConvex\) \{\s*\/\/ Convex is available synchronously\s*const \{ createConvexBackend \} = require\("\.\/convex"\)\s*backendInstance = createConvexBackend\(\)\s*\}/g,
        "}"
      )

      // Remove ConvexReactClient export
      content = content.replace(
        /export type \{ ConvexReactClient \} from "convex\/react"\n?/g,
        ""
      )

      fs.writeFileSync(indexPath, content)
      console.log(chalk.dim(`   • Updated services/backend/index.ts`))
    }
  } catch (error) {
    console.warn(chalk.yellow(`   ⚠️ Could not update services/backend/index.ts: ${error.message}`))
  }
}

// Update providers/index.ts to remove Supabase exports when using Convex
const updateProvidersIndexForConvex = (selectedProvider: BackendProvider): void => {
  const indexPath = path.join(__dirname, "apps/app/app/providers/index.ts")
  if (!fs.existsSync(indexPath)) return

  try {
    let content = fs.readFileSync(indexPath, "utf8")

    if (selectedProvider === "convex") {
      // Remove Supabase-related exports
      content = content.replace(
        /export \{ SupabaseProvider, getSupabaseClient \} from "\.\/SupabaseProvider"\n/g,
        ""
      )
      content = content.replace(
        /export \{ SupabaseAuthSync \} from "\.\/SupabaseAuthSync"\n/g,
        ""
      )
    }

    fs.writeFileSync(indexPath, content)
    console.log(chalk.dim(`   • Updated providers/index.ts for Convex`))
  } catch (error) {
    console.warn(chalk.yellow(`   ⚠️ Could not update providers/index.ts: ${error.message}`))
  }
}

// Update backend provider imports when using Convex
const updateBackendProviderImportsForConvex = (selectedProvider: BackendProvider): void => {
  // For Convex, we want to remove Supabase imports from various files
  const configEnvPath = path.join(__dirname, "apps/app/app/config/env.ts")
  if (!fs.existsSync(configEnvPath)) return

  try {
    let content = fs.readFileSync(configEnvPath, "utf8")

    if (selectedProvider === "convex") {
      // No changes needed for env.ts when using Convex
      // The isConvex check will return true
    }

    fs.writeFileSync(configEnvPath, content)
  } catch (error) {
    console.warn(chalk.yellow(`   ⚠️ Could not update config/env.ts: ${error.message}`))
  }
}

// Update services/backend/index.ts when using Convex
const updateBackendServiceIndexForConvex = (selectedProvider: BackendProvider): void => {
  const indexPath = path.join(__dirname, "apps/app/app/services/backend/index.ts")
  if (!fs.existsSync(indexPath)) return

  try {
    let content = fs.readFileSync(indexPath, "utf8")

    if (selectedProvider === "convex") {
      // Remove Supabase-related exports
      content = content.replace(
        /export \{ supabase, getSupabaseClient \} from "\.\/supabase\/client"\n/g,
        ""
      )
      content = content.replace(
        /export type \{ Database \} from "\.\/supabase\/database\.types"\n?/g,
        ""
      )
      // Remove TypedSupabaseClient type export (since supabase/client is deleted)
      content = content.replace(
        /export type \{ TypedSupabaseClient \} from "\.\/supabase\/client"\n?/g,
        ""
      )
      // Remove the isSupabase dynamic import branch in getBackendAsync
      content = content.replace(
        /\s*if \(isSupabase\) \{\s*\/\/ Dynamically import Supabase backend\s*const \{ createSupabaseBackend \} = await import\("\.\/supabase"\)\s*backendInstance = createSupabaseBackend\(\)\s*\} else /gm,
        "\n      "
      )
      // Remove the isSupabase synchronous require branch in getBackend
      content = content.replace(
        /\s*if \(isSupabase\) \{\s*\/\/ Supabase is available synchronously\s*const \{ createSupabaseBackend \} = require\("\.\/supabase"\)\s*backendInstance = createSupabaseBackend\(\)\s*\} else /gm,
        "\n      "
      )
      // Remove isSupabase import if no longer needed
      content = content.replace(
        /import \{ env, isSupabase, isConvex \} from "\.\.\/\.\.\/config\/env"/,
        'import { env, isConvex } from "../../config/env"'
      )
    }

    fs.writeFileSync(indexPath, content)
    console.log(chalk.dim(`   • Updated services/backend/index.ts for Convex`))
  } catch (error) {
    console.warn(chalk.yellow(`   ⚠️ Could not update services/backend/index.ts: ${error.message}`))
  }
}

// Update files with conditional exports to use only Convex versions
const updateConditionalExportsForConvex = (selectedProvider: BackendProvider): void => {
  if (selectedProvider !== "convex") return

  // Files that have conditional exports - update them to use Convex versions
  const filesToUpdate = [
    {
      file: "apps/app/app/screens/ProfileScreen.tsx",
      exportName: "ProfileScreen",
      convexPath: "./ProfileScreen.convex"
    },
    {
      file: "apps/app/app/screens/ResetPasswordScreen.tsx",
      exportName: "ResetPasswordScreen",
      convexPath: "./ResetPasswordScreen.convex"
    },
    {
      file: "apps/app/app/screens/DataDemoScreen.tsx",
      exportName: "DataDemoScreen",
      convexPath: "./DataDemoScreen.convex"
    },
    {
      file: "apps/app/app/services/widgets.ts",
      exportName: "widgetService",
      convexPath: "./widgets.convex"
    },
  ]

  for (const { file, exportName, convexPath } of filesToUpdate) {
    const filePath = path.join(__dirname, file)
    if (!fs.existsSync(filePath)) continue

    try {
      let content = fs.readFileSync(filePath, "utf8")

      // Replace conditional export pattern with direct convex export
      // Pattern matches: export const X = isConvex ? require("./X.convex").X : require("./X.supabase").X
      const conditionalPattern = new RegExp(
        `export\\s+const\\s+${exportName}\\s*=\\s*isConvex\\s*\\?\\s*require\\([^)]+\\.convex[^)]*\\)\\.${exportName}\\s*:\\s*require\\([^)]+\\.supabase[^)]*\\)\\.${exportName}`,
        "m"
      )

      if (conditionalPattern.test(content)) {
        content = content.replace(
          conditionalPattern,
          `export { ${exportName} } from "${convexPath}"`
        )

        // Remove the isConvex import if it's no longer used
        if (!content.includes("isConvex") || content.match(/isConvex/g)?.length === 1) {
          content = content.replace(/import\s*{\s*isConvex\s*}\s*from\s*["']@\/config\/env["']\s*\n?/, "")
        }

        fs.writeFileSync(filePath, content)
        console.log(chalk.dim(`   • Updated ${file}`))
      }
    } catch (error) {
      console.warn(chalk.yellow(`   ⚠️ Could not update ${file}: ${error.message}`))
    }
  }

  // Also update files with inline conditional requires
  updateInlineConditionalRequiresForConvex(selectedProvider)
}

// Update files with conditional exports to use only Supabase versions
const updateConditionalExports = (selectedProvider: BackendProvider): void => {
  if (selectedProvider !== "supabase") return

  // Files that have conditional exports like:
  // export const X = isConvex ? require("./X.convex").X : require("./X.supabase").X
  const filesToUpdate = [
    {
      file: "apps/app/app/screens/ProfileScreen.tsx",
      exportName: "ProfileScreen",
      supabasePath: "./ProfileScreen.supabase"
    },
    {
      file: "apps/app/app/screens/ResetPasswordScreen.tsx",
      exportName: "ResetPasswordScreen",
      supabasePath: "./ResetPasswordScreen.supabase"
    },
    {
      file: "apps/app/app/screens/DataDemoScreen.tsx",
      exportName: "DataDemoScreen",
      supabasePath: "./DataDemoScreen.supabase"
    },
    {
      file: "apps/app/app/services/widgets.ts",
      exportName: "widgetService",
      supabasePath: "./widgets.supabase"
    },
  ]

  for (const { file, exportName, supabasePath } of filesToUpdate) {
    const filePath = path.join(__dirname, file)
    if (!fs.existsSync(filePath)) continue

    try {
      let content = fs.readFileSync(filePath, "utf8")

      // Replace conditional export pattern with direct supabase export
      // Pattern: export const X = isConvex ? require("./X.convex").X : require("./X.supabase").X
      const conditionalPattern = new RegExp(
        `export\\s+const\\s+${exportName}\\s*=\\s*isConvex[\\s\\S]*?require\\([^)]+\\.supabase[^)]*\\)\\.${exportName}`,
        "m"
      )

      if (conditionalPattern.test(content)) {
        content = content.replace(
          conditionalPattern,
          `export { ${exportName} } from "${supabasePath}"`
        )

        // Remove the isConvex import if it's no longer used
        if (!content.includes("isConvex") || content.match(/isConvex/g)?.length === 1) {
          content = content.replace(/import\s*{\s*isConvex\s*}\s*from\s*["']@\/config\/env["']\s*\n?/, "")
        }

        fs.writeFileSync(filePath, content)
        console.log(chalk.dim(`   • Updated ${file}`))
      }
    } catch (error) {
      console.warn(chalk.yellow(`   ⚠️ Could not update ${file}: ${error.message}`))
    }
  }

  // Also update files with inline conditional requires (hooks, services, etc.)
  updateInlineConditionalRequires(selectedProvider)
}

// Update files with inline conditional requires - file by file specific replacements
const updateInlineConditionalRequires = (selectedProvider: BackendProvider): void => {
  if (selectedProvider !== "supabase") return

  // widgets.ts - replace conditional with direct supabase import
  updateFileContent("apps/app/app/services/widgets.ts", (content) => {
    // Remove the isConvex ternary and just use supabase
    content = content.replace(
      /const widgetService = isConvex \? require\("\.\/widgets\.convex"\) : require\("\.\/widgets\.supabase"\)/,
      'const widgetService = require("./widgets.supabase")'
    )
    // Remove isConvex import
    content = content.replace(/import \{ isConvex \} from [^\n]+\n/, "")
    return content
  })

  // DeleteAccountModal.tsx - replace conditional with nulls since we're supabase only
  updateFileContent("apps/app/app/components/DeleteAccountModal.tsx", (content) => {
    // Remove the isConvex import line
    content = content.replace(
      /import \{ isConvex \} from "@\/config\/env"\n/,
      ""
    )
    // Replace conditional require block with static nulls
    content = content.replace(
      /\/\/ Conditionally import Convex hooks\s*\n\/\/ eslint-disable-next-line.*\nconst \{ useMutation, api \} = isConvex[\s\S]*?\{ useMutation: null, api: null \}/,
      "// Convex removed - using Supabase only\nconst useMutation = null\nconst api = null"
    )
    // Also update the line that uses isConvex && useMutation
    content = content.replace(
      /const convexDeleteAccount = isConvex && useMutation \? useMutation\(api\.users\.deleteAccount\) : null/,
      "const convexDeleteAccount = null // Convex removed"
    )
    // Remove the isConvex check in handleDelete - just use Supabase path directly
    content = content.replace(
      /if \(isConvex && convexDeleteAccount\) \{\s*\/\/ Convex backend: Use mutation[\s\S]*?resetAuthState\(userId\)\s*\} else \{/,
      "// Supabase only - use deleteSupabaseAccount\n      {"
    )
    return content
  })

  // useAppAuth.ts - completely rewrite useAuth to only use Supabase
  updateFileContent("apps/app/app/hooks/useAppAuth.ts", (content) => {
    // Remove the isConvex import
    content = content.replace(/import \{ isConvex \} from "\.\.\/config\/env"\n/, "")

    // Replace the entire Convex Implementation section with a placeholder comment
    // Match from "// Convex Implementation" section to just before "// Main Hook" section
    content = content.replace(
      /\/\/ ============================================================================\n\/\/ Convex Implementation\n\/\/ ============================================================================\n\nfunction useConvexAppAuth\(\): AppAuthState & AppAuthActions \{[\s\S]*?(?=\/\/ ============================================================================\n\/\/ Main Hook)/,
      `// ============================================================================
// Convex Implementation (removed - using Supabase only)
// ============================================================================

// Convex code has been removed. If you need Convex, restore from git or re-clone.

`
    )

    // Remove the useSelectedAuthHook ternary and rewrite useAuth to call Supabase directly
    content = content.replace(
      /const useSelectedAuthHook: \(\) => AppAuthState & AppAuthActions = isConvex\n  \? useConvexAppAuth\n  : useSupabaseAppAuth\n\nexport function useAuth\(\): AppAuthState & AppAuthActions \{\n  return useSelectedAuthHook\(\)\n\}/,
      `export function useAuth(): AppAuthState & AppAuthActions {
  return useSupabaseAppAuth()
}`
    )

    return content
  })

  // useAuth.ts - replace the Convex hook function with a stub
  updateFileContent("apps/app/app/hooks/useAuth.ts", (content) => {
    // Replace the entire Convex Implementation section with a placeholder comment
    content = content.replace(
      /\/\/ ============================================================================\n\/\/ Convex Implementation\n\/\/ ============================================================================\n\n[\s\S]*?(?=\/\/ ============================================================================\n\/\/ Main Hook Export)/,
      `// ============================================================================
// Convex Implementation (removed - using Supabase only)
// ============================================================================

// Convex code has been removed. If you need Convex, restore from git or re-clone.

`
    )

    // Remove the useSelectedAuthImpl ternary and rewrite useAuth to call Supabase directly
    content = content.replace(
      /const useSelectedAuthImpl: \(\) => UseAuthReturn = isConvex \? useConvexAuthImpl : useSupabaseAuth\n\nexport function useAuth\(\): UseAuthReturn \{\n  return useSelectedAuthImpl\(\)\n\}/,
      `export function useAuth(): UseAuthReturn {
  return useSupabaseAuth()
}`
    )

    // Remove isConvex from the import (keep env if present)
    content = content.replace(/import \{ env, isConvex \} from "\.\.\/config\/env"\n/, 'import { env } from "../config/env"\n')
    content = content.replace(/import \{ isConvex \} from "\.\.\/config\/env"\n/, "")

    // Remove the useConvexAuth export since the function was removed
    content = content.replace(/\/\*\*\n \* Force use of Convex auth regardless of env config\.\n \* Useful for migration or testing scenarios\.\n \*\/\nexport \{ useConvexAuthImpl as useConvexAuth \}\n/, "")

    return content
  })

  // accountDeletion.ts - remove convex conditional
  updateFileContent("apps/app/app/services/accountDeletion.ts", (content) => {
    // Remove the entire Convex conditional block (lines 23-27)
    content = content.replace(
      /\/\/ Conditionally import Convex client.*\n\/\/ eslint-disable-next-line.*\nconst \{ convexClient: _convexClient \} = isConvex\s*\n\s*\? require\("\.\/backend\/convex\/client"\)\s*\n\s*: \{ convexClient: null \}/,
      "// Convex removed - using Supabase only\nconst _convexClient = null"
    )
    // Remove isConvex from imports
    content = content.replace(/, isConvex/g, "")
    return content
  })

  // preferencesSync.ts - remove convex conditional
  updateFileContent("apps/app/app/services/preferencesSync.ts", (content) => {
    // Remove the Convex conditional block (lines 29-31)
    content = content.replace(
      /\/\/ Conditionally import Convex push token service\s*\n\/\/ eslint-disable-next-line.*\nconst convexPushTokens = isConvex \? require\("\.\/backend\/convex\/pushTokens"\) : null/,
      "// Convex removed - using Supabase only\nconst convexPushTokens = null"
    )
    // Update shouldSkipPreferenceSync to not reference isConvex
    content = content.replace(
      /const shouldSkipPreferenceSync = isConvex \|\| isUsingMockSupabase/,
      "const shouldSkipPreferenceSync = isUsingMockSupabase // Convex removed"
    )
    // Remove all `if (isConvex && convexPushTokens)` blocks
    content = content.replace(
      /if \(isConvex && convexPushTokens\) \{[\s\S]*?return\s*\n\s*\}/g,
      "// Convex push tokens removed"
    )
    // Remove isConvex from imports
    content = content.replace(/, isConvex/g, "")
    return content
  })

  // hooks/index.ts - remove convex exports and examples
  updateFileContent("apps/app/app/hooks/index.ts", (content) => {
    // Remove the entire Convex Data Hooks section (lines 82-94)
    content = content.replace(
      /\/\/ ============================================================================\n\/\/ Convex Data Hooks \(only needed if using Convex backend\)\n\/\/ ============================================================================\n\nexport \{[\s\S]*?\} from "\.\/convex"\n/,
      ""
    )
    // Remove convex example from comments (lines 19-27)
    content = content.replace(
      / \* ## Convex Data Hooks \(if using Convex backend\)\n \*\n \* ```tsx\n \* import \{ useQuery, useMutation \} from "@\/hooks"\n \* import \{ api \} from "@convex\/_generated\/api"\n \*\n \* const users = useQuery\(api\.users\.list\)  \/\/ Reactive!\n \* const updateUser = useMutation\(api\.users\.update\)\n \* ```\n \*\n/,
      ""
    )
    // Update the comment about useAuth supporting both backends
    content = content.replace(
      /`useAuth\(\)` is the ONLY auth hook you need\. It works with both Supabase and Convex backends\./,
      "`useAuth()` is the ONLY auth hook you need."
    )
    return content
  })

  // AuthCallbackScreen.tsx - remove convex import in callback
  updateFileContent("apps/app/app/screens/AuthCallbackScreen.tsx", (content) => {
    // Replace the dynamic import block with a comment
    content = content.replace(
      /\/\/ Dynamic import to avoid loading Convex in Supabase builds\s*\n\s*\/\/ Dynamic import to ensure Convex auth is available\s*\n\s*await import\("@convex-dev\/auth\/react"\)/,
      "// Convex removed - using Supabase only"
    )
    return content
  })

  // NOTE: useAuth.ts cleanup is now fully handled by the updateFileContent call above
  // that removes the entire Convex Implementation section and rewrites the ternary

  // Update stores/auth/index.ts to directly export from supabase subdirectory
  // The convex subdirectory has been deleted (added to pathsToRemove)
  const supabaseAuthStoreIndexContent = `/**
 * Auth Store Exports
 *
 * Public exports for the authentication store (Supabase implementation).
 */

// Export shared types and constants
export { GUEST_USER_KEY } from "./authConstants"
export type { AuthState, PersistedAuthState } from "./authTypes"

// Export from Supabase implementation
export { useAuthStore } from "./supabase/authStore"
export {
  syncOnboardingToDatabase,
  syncOnboardingStatus,
  fetchOnboardingFromDatabase,
  updateUserState,
  getEmailRedirectUrl,
  getPasswordResetRedirectUrl,
} from "./supabase/authHelpers"
`
  const authStoreIndexPath = path.join(__dirname, "apps/app/app/stores/auth/index.ts")
  try {
    fs.writeFileSync(authStoreIndexPath, supabaseAuthStoreIndexContent)
    console.log(chalk.dim("   • Updated stores/auth/index.ts to use Supabase implementation"))
  } catch (error) {
    console.warn(chalk.yellow(`   ⚠️ Could not update stores/auth/index.ts: ${error.message}`))
  }
}

// Update files with inline conditional requires when Convex is selected (remove Supabase references)
const updateInlineConditionalRequiresForConvex = (selectedProvider: BackendProvider): void => {
  if (selectedProvider !== "convex") return

  // widgets.ts - replace conditional with direct convex import and remove supabase type export
  updateFileContent("apps/app/app/services/widgets.ts", (content) => {
    content = content.replace(
      /const widgetService = isConvex \? require\("\.\/widgets\.convex"\) : require\("\.\/widgets\.supabase"\)/,
      'const widgetService = require("./widgets.convex")'
    )
    content = content.replace(/import \{ isConvex \} from [^\n]+\n/, "")
    // Remove the supabase type export since widgets.supabase.ts is deleted
    content = content.replace(/export type \{ WidgetCache \} from "\.\/widgets\.supabase"\n/, "")
    return content
  })

  // DeleteAccountModal.tsx - keep the convex imports since we're using Convex
  // No changes needed - Convex code should stay

  // useAppAuth.ts - completely rewrite useAuth to only use Convex
  updateFileContent("apps/app/app/hooks/useAppAuth.ts", (content) => {
    // Remove the isConvex import
    content = content.replace(/import \{ isConvex \} from "\.\.\/config\/env"\n/, "")

    // Replace the entire Supabase Implementation section with a placeholder comment
    content = content.replace(
      /\/\/ ============================================================================\n\/\/ Supabase Implementation\n\/\/ ============================================================================\n\nfunction useSupabaseAppAuth\(\): AppAuthState & AppAuthActions \{[\s\S]*?(?=\/\/ ============================================================================\n\/\/ Convex Implementation)/,
      `// ============================================================================
// Supabase Implementation (removed - using Convex only)
// ============================================================================

// Supabase code has been removed. If you need Supabase, restore from git or re-clone.

`
    )

    // Remove the isConvex guard in useConvexAppAuth (not needed when Convex is the only backend)
    content = content.replace(
      /  \/\/ If Convex is not the selected backend, return stub implementation\n  \/\/ This prevents trying to call Convex hooks when ConvexProvider isn't in the tree\n  if \(!isConvex\) \{[\s\S]*?\n  \}\n\n/,
      ""
    )

    // Remove stale isConvex comment
    content = content.replace(/  \/\/ Note: isConvex is a build-time constant[\s\S]*?determined at build time\)\n/, "")

    // Remove the useSelectedAuthHook ternary and rewrite useAuth to call Convex directly
    content = content.replace(
      /const useSelectedAuthHook: \(\) => AppAuthState & AppAuthActions = isConvex\n  \? useConvexAppAuth\n  : useSupabaseAppAuth\n\nexport function useAuth\(\): AppAuthState & AppAuthActions \{\n  return useSelectedAuthHook\(\)\n\}/,
      `export function useAuth(): AppAuthState & AppAuthActions {
  return useConvexAppAuth()
}`
    )

    return content
  })

  // accountDeletion.ts and preferencesSync.ts are now deleted when Convex is selected
  // Convex handles account deletion via mutations in the profile screen
  // Convex handles preferences via mutations directly in components

  // DeleteAccountModal.tsx - remove accountDeletion import and usage (it's deleted)
  updateFileContent("apps/app/app/components/DeleteAccountModal.tsx", (content) => {
    // Remove the import for deleteSupabaseAccount - Convex uses mutations instead
    content = content.replace(
      /import \{ deleteAccount as deleteSupabaseAccount \} from "@\/services\/accountDeletion"\n/,
      ""
    )
    // Remove the else branch that calls deleteSupabaseAccount (Supabase backend)
    // The Convex branch handles account deletion via convexDeleteAccount mutation
    content = content.replace(
      /} else \{\s*\/\/ Supabase backend: Use service\s*const result = await deleteSupabaseAccount\(\)[\s\S]*?if \(result\.error\) \{\s*throw result\.error\s*\}\s*\}/,
      `} else {
        // Supabase removed - Convex handles account deletion
        throw new Error("Backend not configured")
      }`
    )
    return content
  })

  // AuthCallbackScreen.tsx - remove Supabase import and simplify callback handling
  updateFileContent("apps/app/app/screens/AuthCallbackScreen.tsx", (content) => {
    // Remove isSupabase import since we only have Convex
    content = content.replace(
      /import \{ isConvex, isSupabase \} from "@\/config\/env"/,
      'import { isConvex } from "@/config/env"'
    )
    // Remove the entire Supabase callback handling block
    content = content.replace(
      /\/\/ ================================================================\s*\/\/ Supabase OAuth Callback Handling[\s\S]*?throw new Error\(t\("authCallbackScreen:invalidParams"\)\)/,
      `// Supabase removed - only Convex is configured
        throw new Error(t("authCallbackScreen:invalidParams"))`
    )
    return content
  })

  // notificationStore.ts - remove preferencesSync imports (Convex handles via mutations)
  updateFileContent("apps/app/app/stores/notificationStore.ts", (content) => {
    // Remove the preferencesSync import
    content = content.replace(
      /import \{ syncPushNotificationsPreference, syncPushToken \} from "@\/services\/preferencesSync"\n/,
      ""
    )
    // Replace usage of syncPushNotificationsPreference with a no-op comment
    content = content.replace(
      /syncPushNotificationsPreference\([^)]*\)/g,
      "/* syncPushNotificationsPreference removed - use Convex mutations */"
    )
    content = content.replace(
      /syncPushToken\([^)]*\)/g,
      "/* syncPushToken removed - use Convex mutations */"
    )
    return content
  })

  // theme/context.tsx - remove preferencesSync import (Convex handles via mutations)
  updateFileContent("apps/app/app/theme/context.tsx", (content) => {
    // Remove the preferencesSync import
    content = content.replace(
      /import \{ syncDarkModePreference \} from "@\/services\/preferencesSync"\n/,
      ""
    )
    // Replace usage with no-op
    content = content.replace(
      /syncDarkModePreference\([^)]*\)/g,
      "/* syncDarkModePreference removed - use Convex mutations */"
    )
    return content
  })

  // OnboardingScreen.tsx - drop preferencesSync + types/supabase imports
  // (both files are deleted when Convex is chosen). Inline the OnboardingGoal
  // union and replace the syncGoalPreference call with a logger note.
  updateFileContent("apps/app/app/screens/OnboardingScreen.tsx", (content) => {
    content = content.replace(
      /import \{ syncGoalPreference \} from "@\/services\/preferencesSync"\n/,
      ""
    )
    content = content.replace(
      /import type \{ OnboardingGoal \} from "@\/types\/supabase"\n/,
      'type OnboardingGoal = "goalBuildApp" | "goalLearnReactNative" | "goalJustExploring"\n'
    )
    content = content.replace(
      /if \(userId\) \{\s*\/\/ Fire-and-forget; another agent owns the storage layer\.\s*syncGoalPreference\(userId, selectedGoal\)\s*\} else \{\s*logger\.debug\([^)]*\)\s*\}/,
      'logger.debug("🎯 [Onboarding] Goal selected (sync via Convex mutation)", { userId, selectedGoal })'
    )
    return content
  })

  // hooks/index.ts - update comment about useAuth (keep Convex exports)
  updateFileContent("apps/app/app/hooks/index.ts", (content) => {
    // Update the comment about useAuth supporting both backends
    content = content.replace(
      /`useAuth\(\)` is the ONLY auth hook you need\. It works with both Supabase and Convex backends\./,
      "`useAuth()` is the ONLY auth hook you need."
    )
    return content
  })

  // WelcomeScreen.tsx - update useAuth import and use isLoading instead of loading
  updateFileContent("apps/app/app/screens/WelcomeScreen.tsx", (content) => {
    // Update import to use the hooks index (which exports useAuth from useAppAuth)
    content = content.replace(
      /import \{ useAuth \} from "@\/hooks\/useAuth"/,
      'import { useAuth } from "@/hooks"'
    )
    // Update from 'loading' to 'isLoading' (useAppAuth uses isLoading)
    content = content.replace(
      /const \{ signInWithGoogle, signInWithApple, loading \} = useAuth\(\)/,
      "const { signInWithGoogle, signInWithApple, isLoading } = useAuth()"
    )
    // Replace all occurrences of loading with isLoading
    content = content.replace(/\{ loading \}/g, "{ isLoading }")
    content = content.replace(/disabled=\{loading\}/g, "disabled={isLoading}")
    return content
  })

  // useAuth.ts - remove Supabase implementation and wire directly to Convex
  updateFileContent("apps/app/app/hooks/useAuth.ts", (content) => {
    // Replace the entire Supabase Implementation section with a placeholder comment
    content = content.replace(
      /\/\/ ============================================================================\n\/\/ Supabase Implementation\n\/\/ ============================================================================\n\nfunction useSupabaseAuth\(\): UseAuthReturn \{[\s\S]*?(?=\/\/ ============================================================================\n\/\/ Convex Implementation)/,
      `// ============================================================================
// Supabase Implementation (removed - using Convex only)
// ============================================================================

// Supabase code has been removed. If you need Supabase, restore from git or re-clone.

`
    )

    // Remove the isConvex guard in useConvexAuthImpl (not needed when Convex is the only backend)
    content = content.replace(
      /  \/\/ If Convex is not the selected backend, return stub implementation\n  \/\/ This prevents trying to call Convex hooks when ConvexProvider isn't in the tree\n  if \(!isConvex\) \{[\s\S]*?\n  \}\n\n/,
      ""
    )

    // Remove stale isConvex comment
    content = content.replace(/  \/\/ Note: isConvex is a build-time constant[\s\S]*?determined at build time\)\n/, "")

    // Remove the useSelectedAuthImpl ternary and rewrite useAuth to call Convex directly
    content = content.replace(
      /const useSelectedAuthImpl: \(\) => UseAuthReturn = isConvex \? useConvexAuthImpl : useSupabaseAuth\n\nexport function useAuth\(\): UseAuthReturn \{\n  return useSelectedAuthImpl\(\)\n\}/,
      `export function useAuth(): UseAuthReturn {
  return useConvexAuthImpl()
}`
    )

    // Remove isConvex from the import (keep env if present)
    content = content.replace(/import \{ env, isConvex \} from "\.\.\/config\/env"\n/, 'import { env } from "../config/env"\n')
    content = content.replace(/import \{ isConvex \} from "\.\.\/config\/env"\n/, "")

    // Remove the useSupabaseAuth export since Supabase is removed
    content = content.replace(/export \{ useSupabaseAuth \}\n/, "")

    return content
  })

  // Replace types/auth.ts with Convex-compatible version
  // The old file re-exports Supabase types, but we need backend-agnostic types
  const convexAuthTypesContent = `/**
 * Platform-agnostic authentication types
 *
 * Re-exports types from the backend service layer for backwards compatibility.
 * These types work with the Convex backend.
 */

import type { BackendUser, BackendSession } from "@/services/backend/types"

// Re-export for backwards compatibility
export type User = BackendUser
export type Session = BackendSession

export type AuthProvider = "convex" | "mock"

export interface ResetPasswordOptions {
  redirectTo?: string
}

export type AuthChangeEvent =
  | "SIGNED_IN"
  | "SIGNED_OUT"
  | "TOKEN_REFRESHED"
  | "USER_UPDATED"
  | "PASSWORD_RECOVERY"

/**
 * Helper to check if user is authenticated
 */
export function isAuthenticated(session: Session | null): boolean {
  if (!session) return false
  if (session.expiresAt && session.expiresAt < Date.now() / 1000) {
    return false
  }
  return true
}

/**
 * Helper to get user from session
 */
export function getUserFromSession(session: Session | null): User | null {
  return session?.user || null
}

/**
 * Helper to check if user's email is confirmed
 */
export function isEmailConfirmed(user: User | null): boolean {
  if (!user) return false
  return !!user.emailConfirmedAt
}
`
  const authTypesPath = path.join(__dirname, "apps/app/app/types/auth.ts")
  try {
    fs.writeFileSync(authTypesPath, convexAuthTypesContent)
    console.log(chalk.dim("   • Replaced types/auth.ts with Convex-compatible version"))
  } catch (error) {
    console.warn(chalk.yellow(`   ⚠️ Could not update types/auth.ts: ${error.message}`))
  }

  // Update files that import @/hooks/useAuth to use @/hooks instead
  const filesToUpdateHooksImport = [
    "apps/app/app/screens/WelcomeScreen.tsx",
    "apps/app/app/screens/MagicLinkScreen.tsx",
  ]
  for (const filePath of filesToUpdateHooksImport) {
    updateFileContent(filePath, (content) => {
      return content.replace(
        /import \{ useAuth \} from ["']@\/hooks\/useAuth["']/g,
        'import { useAuth } from "@/hooks"'
      )
    })
  }

  // AuthCallbackScreen imports from @/services/supabase - we need to remove or update this
  // For Convex, the auth callback would be handled differently
  updateFileContent("apps/app/app/screens/AuthCallbackScreen.tsx", (content) => {
    // Remove the supabase import and update the code to use Convex
    content = content.replace(
      /import \{ supabase \} from ["']@\/services\/supabase["']\n?/g,
      ""
    )
    // Replace supabase.auth.getSession() calls with null since Convex handles this differently
    content = content.replace(
      /await supabase\.auth\.getSession\(\)/g,
      "{ data: { session: null }, error: null }"
    )
    content = content.replace(
      /supabase\.auth\.exchangeCodeForSession\([^)]+\)/g,
      "Promise.resolve({ data: { session: null }, error: null })"
    )
    return content
  })

  // Update files importing @/services/accountDeletion - DeleteAccountModal needs updating for Convex
  updateFileContent("apps/app/app/components/DeleteAccountModal.tsx", (content) => {
    // Remove accountDeletion import and add Convex mutation approach
    content = content.replace(
      /import \{ deleteAccount, AccountDeletionState \} from ["']@\/services\/accountDeletion["']/g,
      `// Account deletion is handled via Convex mutations
type AccountDeletionState = "idle" | "deleting" | "deleted" | "error"`
    )
    return content
  })

  // Update files importing @/services/preferencesSync
  updateFileContent("apps/app/app/stores/notificationStore.ts", (content) => {
    // Remove preferencesSync imports - Convex handles this via mutations
    content = content.replace(
      /import \{ syncPreferencesToServer \} from ["']@\/services\/preferencesSync["']\n?/g,
      "// Note: Preferences sync is handled via Convex mutations\nconst syncPreferencesToServer = async () => { /* Convex handles this */ }\n"
    )
    // Also remove authStore import if present
    content = content.replace(
      /import \{ useAuthStore \} from ["']@\/stores\/auth\/authStore["']\n?/g,
      "// Auth state is managed via Convex - use useAuth() hook instead\n"
    )
    return content
  })

  updateFileContent("apps/app/app/theme/context.tsx", (content) => {
    // Remove preferencesSync import
    content = content.replace(
      /import \{ syncPreferencesToServer \} from ["']@\/services\/preferencesSync["']\n?/g,
      "// Note: Theme preferences are synced via Convex mutations\nconst syncPreferencesToServer = async (_prefs: Record<string, unknown>) => { /* Convex handles this */ }\n"
    )
    return content
  })

  // Update SubscriptionContext that imports AuthContext (which was deleted)
  updateFileContent("apps/app/app/context/SubscriptionContext.tsx", (content) => {
    // Remove AuthContext import and use useAuth from hooks instead
    content = content.replace(
      /import \{ useAuth \} from ["']\.\/AuthContext["']/g,
      'import { useAuth } from "@/hooks"'
    )
    return content
  })

  // Update ConvexAuthSync that imports types/auth
  updateFileContent("apps/app/app/providers/ConvexAuthSync.tsx", (content) => {
    // Update the import to use the new auth types location
    content = content.replace(
      /import type \{ [^}]+ \} from ["']\.\.\/types\/auth["']/g,
      'import type { User, Session } from "@/types/auth"'
    )
    return content
  })

  // Update stores/auth files that import from types/auth or deleted files
  updateFileContent("apps/app/app/stores/auth/authTypes.ts", (content) => {
    content = content.replace(
      /import type \{ User, Session \} from ["']\.\.\/\.\.\/types\/auth["']/g,
      'import type { User, Session } from "@/types/auth"'
    )
    return content
  })

  updateFileContent("apps/app/app/stores/auth/authConstants.ts", (content) => {
    content = content.replace(
      /import type \{ [^}]+ \} from ["']\.\.\/\.\.\/types\/auth["']/g,
      'import type { User } from "@/types/auth"'
    )
    return content
  })

  // Update stores/auth/index.ts to directly export from convex subdirectory
  // The supabase subdirectory has been deleted (added to pathsToRemove)
  const convexAuthStoreIndexContent = `/**
 * Auth Store Exports
 *
 * For Convex backend, auth state is managed via useAuth() from @/hooks.
 * This file re-exports from the Convex implementation.
 *
 * MIGRATION NOTE: Prefer using useAuth() from @/hooks directly.
 * The useAuthStore exists for backwards compatibility.
 */

// Export shared types and constants
export { GUEST_USER_KEY } from "./authConstants"
export type { AuthState, PersistedAuthState } from "./authTypes"

// Export from Convex implementation
export {
  useAuthStore,
  syncOnboardingToDatabase,
  syncOnboardingStatus,
  fetchOnboardingFromDatabase,
  updateUserState,
  getEmailRedirectUrl,
  getPasswordResetRedirectUrl,
} from "./convex"
`
  const authStoreIndexPath = path.join(__dirname, "apps/app/app/stores/auth/index.ts")
  try {
    fs.writeFileSync(authStoreIndexPath, convexAuthStoreIndexContent)
    console.log(chalk.dim("   • Updated stores/auth/index.ts to use Convex implementation"))
  } catch (error) {
    console.warn(chalk.yellow(`   ⚠️ Could not update stores/auth/index.ts: ${error.message}`))
  }

  // Update utils/authorization.ts
  updateFileContent("apps/app/app/utils/authorization.ts", (content) => {
    content = content.replace(
      /import type \{ [^}]+ \} from ["']\.\.\/types\/auth["']/g,
      'import type { User } from "@/types/auth"'
    )
    return content
  })

  // Update hooks/useEmailVerificationPolling.ts
  updateFileContent("apps/app/app/hooks/useEmailVerificationPolling.ts", (content) => {
    content = content.replace(
      /import type \{ [^}]+ \} from ["']\.\.\/types\/auth["']/g,
      'import type { User } from "@/types/auth"'
    )
    return content
  })

  // Delete test files that depend on Supabase infrastructure
  const testFilesToDelete = [
    "apps/app/app/__tests__/integration/notificationFlow.test.tsx",
  ]
  for (const filePath of testFilesToDelete) {
    const fullPath = path.join(__dirname, filePath)
    if (fs.existsSync(fullPath)) {
      fs.rmSync(fullPath, { force: true })
      console.log(chalk.dim(`   • Removed ${filePath} (Supabase-dependent test)`))
    }
  }

  // Update EpisodeContext which imports from @/services/api
  updateFileContent("apps/app/app/context/EpisodeContext.tsx", (content) => {
    // Remove the api import and use Convex queries instead
    content = content.replace(
      /import \{ [^}]+ \} from ["']@\/services\/api["']\n?/g,
      "// Note: Data fetching is handled via Convex queries - use useQuery() from @/hooks/convex\n"
    )
    // Mock the functions if they're called
    content = content.replace(
      /fetchEpisodes\([^)]*\)/g,
      "Promise.resolve([])"
    )
    return content
  })
}

// Helper to update file content with a transform function
const updateFileContent = (relativePath: string, transform: (content: string) => string): void => {
  const filePath = path.join(__dirname, relativePath)
  if (!fs.existsSync(filePath)) return

  try {
    const content = fs.readFileSync(filePath, "utf8")
    const newContent = transform(content)
    if (newContent !== content) {
      fs.writeFileSync(filePath, newContent)
      console.log(chalk.dim(`   • Updated ${relativePath}`))
    }
  } catch (error) {
    console.warn(chalk.yellow(`   ⚠️ Could not update ${relativePath}: ${error.message}`))
  }
}

// Generate backend-specific .env.example (remove the other backend's section)
const updateEnvExample = (selectedProvider: BackendProvider): boolean => {
  const envExamplePath = path.join(__dirname, "apps/app/.env.example")
  if (!fs.existsSync(envExamplePath)) {
    return false
  }

  try {
    let content = fs.readFileSync(envExamplePath, "utf8")

    if (selectedProvider === "supabase") {
      // Remove Convex section
      content = content.replace(
        /# ============================================\n# Convex Configuration \(when using Convex\)\n# ============================================\n# Get this from:.*\n# Only needed if.*\n# Leave empty to.*\nEXPO_PUBLIC_CONVEX_URL=.*\n\n/,
        ""
      )
      // Update the backend provider comment
      content = content.replace(
        /# Options: "supabase" \(default\) or "convex"\n# This determines which backend.*\n# If not set, defaults to "supabase"/,
        "# Your app uses Supabase for backend services"
      )
    } else {
      // Remove Supabase section
      content = content.replace(
        /# ============================================\n# Supabase Configuration \(when using Supabase\)\n# ============================================\n# Get these from:.*\n# Use the publishable key.*\n# Leave empty to.*\nEXPO_PUBLIC_SUPABASE_URL=.*\nEXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=.*\n\n/,
        ""
      )
      // Update the backend provider comment
      content = content.replace(
        /# Options: "supabase" \(default\) or "convex"\n# This determines which backend.*\n# If not set, defaults to "supabase"/,
        "# Your app uses Convex for backend services"
      )
      // Update the value
      content = content.replace(
        /EXPO_PUBLIC_BACKEND_PROVIDER=supabase/,
        "EXPO_PUBLIC_BACKEND_PROVIDER=convex"
      )
    }

    fs.writeFileSync(envExamplePath, content)
    console.log(chalk.dim(`   • Updated .env.example for ${selectedProvider}`))
    return true
  } catch (error) {
    console.warn(chalk.yellow(`   ⚠️ Could not update .env.example: ${error.message}`))
    return false
  }
}

// Remove unused backend packages from package.json files
const removeUnusedBackendPackages = (selectedProvider: BackendProvider): boolean => {
  const unusedProvider = selectedProvider === "supabase" ? "convex" : "supabase"

  // Packages to remove based on unused provider
  const packagesToRemove = unusedProvider === "convex"
    ? ["convex", "@convex-dev/auth", "@auth/core"]
    : ["@supabase/supabase-js"]

  const packageJsonPaths = [
    path.join(__dirname, "package.json"),
    path.join(__dirname, "apps/app/package.json"),
  ]

  let anyUpdated = false

  for (const pkgPath of packageJsonPaths) {
    if (!fs.existsSync(pkgPath)) continue

    try {
      const content = fs.readFileSync(pkgPath, "utf8")
      const pkg = JSON.parse(content)
      let updated = false

      for (const depToRemove of packagesToRemove) {
        if (pkg.dependencies && pkg.dependencies[depToRemove]) {
          delete pkg.dependencies[depToRemove]
          updated = true
        }
        if (pkg.devDependencies && pkg.devDependencies[depToRemove]) {
          delete pkg.devDependencies[depToRemove]
          updated = true
        }
      }

      if (updated) {
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n")
        console.log(chalk.dim(`   • Removed ${unusedProvider} packages from ${path.relative(__dirname, pkgPath)}`))
        anyUpdated = true
      }
    } catch (error) {
      console.warn(chalk.yellow(`   ⚠️ Could not update ${path.relative(__dirname, pkgPath)}: ${error.message}`))
    }
  }

  return anyUpdated
}

const serviceLabels = {
  appEnv: "App Environment & Links",
  backend: "Backend Provider",
  supabase: "Supabase",
  convex: "Convex",
  google: "Google OAuth",
  apple: "Apple Sign-In",
  posthog: "PostHog",
  revenuecat: "RevenueCat",
  sentry: "Sentry",
  fcm: "Firebase Cloud Messaging",
  widgets: "Native Widgets",
} as const

type ServiceKey = keyof typeof serviceLabels
type ServiceStatus = Record<ServiceKey, boolean>
type BackendProvider = "supabase" | "convex"
type ServiceCatalogEntry = {
  key: ServiceKey
  label: string
  handler: (services: EnvVars, defaults: Partial<EnvVars>, options?: SetupOptions) => Promise<boolean>
}

/**
 * Check if an API key is a placeholder value from .env.example
 * Placeholder values should not count as "configured"
 */
const isValidApiKey = (key: string | undefined): boolean => {
  if (!key) return false
  const lowerKey = key.toLowerCase()
  return !(
    lowerKey.startsWith("your-") ||
    lowerKey.includes("placeholder") ||
    lowerKey.includes("example") ||
    lowerKey.includes("-key-here") ||
    lowerKey === "your-ios-key" ||
    lowerKey === "your-android-key" ||
    lowerKey === "your-web-key"
  )
}

/**
 * Check if Firebase Cloud Messaging is configured
 * FCM is configured by placing google-services.json in the Android app directory
 */
const isFcmConfigured = (): boolean => {
  const googleServicesPath = path.join(__dirname, "apps/app/android/app/google-services.json")
  return fs.existsSync(googleServicesPath)
}

const getServiceStatus = (services: EnvVars): ServiceStatus => {
  const backendProvider = services.EXPO_PUBLIC_BACKEND_PROVIDER || "supabase"
  return {
    appEnv: Boolean(
      services.EXPO_PUBLIC_APP_ENV ||
        services.EXPO_PUBLIC_EMAIL_REDIRECT_URL ||
        services.EXPO_PUBLIC_PASSWORD_RESET_REDIRECT_URL ||
        services.EXPO_PUBLIC_USE_MOCK_NOTIFICATIONS
    ),
    backend: Boolean(services.EXPO_PUBLIC_BACKEND_PROVIDER),
    supabase: backendProvider === "supabase" && (
      isValidApiKey(services.EXPO_PUBLIC_SUPABASE_URL) || isValidApiKey(services.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
    ),
    convex: backendProvider === "convex" && isValidApiKey(services.EXPO_PUBLIC_CONVEX_URL),
    google: isValidApiKey(services.EXPO_PUBLIC_GOOGLE_CLIENT_ID) || isValidApiKey(services.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID),
    apple: isValidApiKey(services.EXPO_PUBLIC_APPLE_SERVICES_ID) || isValidApiKey(services.EXPO_PUBLIC_APPLE_TEAM_ID),
    posthog: isValidApiKey(services.EXPO_PUBLIC_POSTHOG_API_KEY),
    revenuecat: isValidApiKey(services.EXPO_PUBLIC_REVENUECAT_IOS_KEY) ||
      isValidApiKey(services.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY) ||
      isValidApiKey(services.EXPO_PUBLIC_REVENUECAT_WEB_KEY),
    sentry: isValidApiKey(services.EXPO_PUBLIC_SENTRY_DSN),
    // FCM is configured via google-services.json in the Android app directory
    fcm: isFcmConfigured(),
    widgets: Boolean(services.EXPO_PUBLIC_ENABLE_WIDGETS === "true"),
  }
}

const formatServiceList = (status: ServiceStatus, target = true): string[] =>
  Object.entries(status)
    .filter(([, isConfigured]) => isConfigured === target)
    .map(([key]) => serviceLabels[key])
    .filter(Boolean)

// ========================================
// CONFIGURATION SUMMARY
// ========================================
const generateSetupSummary = (
  config: Partial<MetadataConfig>,
  services: EnvVars,
  metadataConfigured: boolean,
  servicesConfigured: number
): string | null => {
  const packageJsonPath = path.join(__dirname, "package.json")
  const version = fs.existsSync(packageJsonPath)
    ? (JSON.parse(fs.readFileSync(packageJsonPath, "utf8")).version as string)
    : "unknown"

  const summary = {
    timestamp: new Date().toISOString(),
    version,
    metadata: {
      displayName: config.displayName,
      projectName: config.projectName,
      bundleId: config.bundleId,
      scheme: config.scheme,
      configured: metadataConfigured,
    },
    services: {
      configured: Object.keys(services).filter((k) => services[k]),
      total: Object.keys(getServiceStatus(services)).length,
      count: servicesConfigured,
    },
    filesModified: [],
  }

  const summaryPath = path.join(__dirname, ".setup-summary.json")
  try {
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2))
    return summaryPath
  } catch (error) {
    console.warn(`⚠️  Could not write setup summary: ${error.message}`)
    return null
  }
}

// ========================================
// CONFIGURATION STEPS
// ========================================
const configureMetadata = async (
  config: Partial<MetadataConfig>,
  defaults: Partial<MetadataConfig> = {}
): Promise<boolean> => {
  printSection("📱 PROJECT METADATA", [
    "Let's set up your app's basic information. Don't worry - you can change these later!",
    "",
    "💡 Tip: You can press Enter to use the suggested default values.",
  ])

  console.log(chalk.cyan("\n📱 App Display Name"))
  console.log(chalk.dim("   This is the name that appears under your app icon on users' phones."))
  console.log(chalk.dim("   Example: 'My Awesome App' or 'Fitness Tracker'"))
  const defaultDisplayName = defaults.displayName || "My Shipnative App"
  config.displayName = await askQuestion("What should your app be called? (shown to users)", validateNotEmpty, defaultDisplayName)

  console.log(chalk.cyan("\n📁 Project Name"))
  console.log(chalk.dim("   This is an internal name used for folders and files."))
  console.log(chalk.dim("   We'll create this automatically from your app name - just press Enter!"))
  const derivedProjectName = config.displayName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
  const defaultProjectName = defaults.projectName || derivedProjectName
  config.projectName = await askQuestion("Project name (lowercase, no spaces) - press Enter to use suggested", (name) => {
    if (!name || name.trim() === "") return true // Allow empty to use default
    return /^[a-z0-9-]+$/.test(name)
  }, defaultProjectName)

  console.log(chalk.cyan("\n🆔 Bundle Identifier"))
  console.log(chalk.dim("   This is like a unique ID for your app in the App Store and Play Store."))
  console.log(chalk.dim("   Format: com.yourcompany.appname (like com.apple.music)"))
  console.log(chalk.dim("   💡 Don't have a company? Use com.yourname.appname"))
  const defaultBundleId = defaults.bundleId || `com.shipnative.${config.projectName.replace(/-/g, "")}`
  config.bundleId = await askQuestion("Bundle identifier (e.g., com.mycompany.myapp)", validateBundleId, defaultBundleId)

  console.log(chalk.cyan("\n🔗 App Scheme"))
  console.log(chalk.dim("   This lets your app open links like 'myapp://profile'"))
  console.log(chalk.dim("   We'll create this automatically - just press Enter!"))
  const defaultScheme = defaults.scheme || config.projectName.replace(/-/g, "")
  config.scheme = await askQuestion("App scheme (for opening links) - press Enter to use suggested", validateScheme, defaultScheme)

  return true
}

const configureBackendProvider = async (
  services: EnvVars,
  defaults: Partial<EnvVars> = {},
  _options: SetupOptions = {}
): Promise<BackendProvider> => {
  printSection("🔧 BACKEND PROVIDER", [
    "Choose your backend - this determines your database, auth, and real-time infrastructure.",
    "",
    "💡 Both options are production-ready:",
    "   • Supabase: PostgreSQL, REST API, real-time subscriptions (recommended for most apps)",
    "   • Convex: TypeScript-native, reactive queries, real-time by default (great for collaborative apps)",
    "",
    "📖 Learn more:",
    "   • Supabase: https://supabase.com",
    "   • Convex: https://convex.dev",
  ])

  const currentProvider = defaults.EXPO_PUBLIC_BACKEND_PROVIDER || "supabase"
  const choice = await askChoice("Which backend would you like to use?", [
    {
      value: "supabase",
      label: "🐘 Supabase (PostgreSQL + REST) - Great for traditional apps, familiar SQL",
    },
    {
      value: "convex",
      label: "⚡ Convex (TypeScript-native) - Great for real-time, collaborative apps",
    },
  ], currentProvider)

  services.EXPO_PUBLIC_BACKEND_PROVIDER = choice as BackendProvider
  return choice as BackendProvider
}

const configureSupabase = async (
  services: EnvVars,
  defaults: Partial<EnvVars> = {},
  options: SetupOptions = {}
): Promise<boolean> => {
  printSection("🔹 SUPABASE (Backend & Auth)", [
    "Supabase powers your app's database, user accounts, and real-time features.",
    "",
    "💡 Don't have a Supabase account yet?",
    "   1. Go to https://supabase.com and sign up (it's free!)",
    "   2. Create a new project",
    "   3. Copy your project URL and API key from Settings > API",
    "",
    "⏭️  You can skip this now and set it up later - your app will work in 'mock mode'.",
  ])

  const shouldConfigure = options.skipConfirm || (await askYesNo("Do you want to set up Supabase now?", true))
  if (!shouldConfigure) {
    console.log(chalk.dim("\n   ✅ Skipped. Your app will use mock data. You can add Supabase later!"))
    return false
  }

  console.log(chalk.cyan("\n📍 Step 1: Project URL"))
  console.log(chalk.dim("   Find this in Supabase: Settings > API > Project URL"))
  console.log(chalk.dim("   Looks like: https://xxxxxxxxxxxxx.supabase.co"))
  services.EXPO_PUBLIC_SUPABASE_URL = await askQuestion("Enter your Supabase Project URL", validateUrl, defaults.EXPO_PUBLIC_SUPABASE_URL)

  console.log(chalk.cyan("\n🔑 Step 2: Publishable Key"))
  console.log(chalk.dim("   Find this in Supabase: Settings > API > API Keys"))
  console.log(chalk.dim("   • For new keys: API Keys tab → Publishable key section"))
  console.log(chalk.dim("   • For legacy keys: Legacy API Keys tab → anon key"))
  console.log(chalk.dim("   💡 New format: sb_publishable_xxx (recommended)"))
  console.log(chalk.dim("   💡 Legacy format: eyJ... (still works)"))
  console.log(chalk.dim("   ⚠️  Never use the 'service_role' key here - that's secret!"))
  services.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = await askQuestion(
    "Enter your Supabase publishable key (safe to use in mobile apps)",
    validateSupabaseKey,
    defaults.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    true // Secret input
  )

  // Optional validation
  if (process.argv.includes("--validate-services") && services.EXPO_PUBLIC_SUPABASE_URL && services.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    const isValid = await validateSupabaseConnection(services.EXPO_PUBLIC_SUPABASE_URL, services.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
    if (!isValid) {
      console.warn("   ⚠️  Could not validate Supabase connection. Please check your URL and key.")
    }
  }

  return true
}

const configureConvex = async (
  services: EnvVars,
  defaults: Partial<EnvVars> = {},
  options: SetupOptions = {}
): Promise<boolean> => {
  printSection("🔹 CONVEX (Backend & Auth)", [
    "Convex provides a TypeScript-native backend with real-time queries and mutations.",
    "",
    "💡 Don't have a Convex account yet?",
    "   1. Go to https://convex.dev and sign up (it's free!)",
    "   2. Run 'npx convex dev' in your project to create a deployment",
    "   3. Your deployment URL will be shown in the terminal",
    "",
    "💡 Your deployment URL looks like: https://xxx-xxx-xxx.convex.cloud",
    "",
    "⚠️  Unlike Supabase, Convex requires 'npx convex dev' running locally.",
    "   There's no mock mode - but local dev is fast and gives you a real database!",
  ])

  const shouldConfigure = options.skipConfirm || (await askYesNo("Do you want to set up Convex now?", true))
  if (!shouldConfigure) {
    console.log(chalk.dim("\n   ✅ Skipped. Run 'npx convex dev' when ready to start your backend."))
    return false
  }

  console.log(chalk.cyan("\n📍 Convex Deployment URL"))
  console.log(chalk.dim("   Find this by running 'npx convex dev' or in your Convex dashboard"))
  console.log(chalk.dim("   Looks like: https://xxx-xxx-xxx.convex.cloud"))
  services.EXPO_PUBLIC_CONVEX_URL = await askQuestion(
    "Enter your Convex deployment URL",
    validateConvexUrl,
    defaults.EXPO_PUBLIC_CONVEX_URL
  )

  console.log(chalk.yellow("\n📝 Important Next Steps:"))
  console.log(chalk.dim("   1. Run 'npx convex dev' to start local backend"))
  console.log(chalk.dim("   2. Run 'npx @convex-dev/auth' to set up auth keys (JWT_PRIVATE_KEY & JWKS)"))
  console.log(chalk.dim("   3. The schema is already set up in convex/schema.ts"))
  console.log(chalk.dim("   4. See vibe/CONVEX.md for authentication setup"))

  return true
}

const configureAppEnvironment = async (
  services: EnvVars,
  defaults: Partial<EnvVars> = {},
  options: SetupOptions = {}
): Promise<boolean> => {
  printSection("🔹 APP ENVIRONMENT & LINKS", [
    "These settings control runtime behavior and where auth links send users.",
    "",
    "✅ Safe to include in EXPO_PUBLIC_ envs (they are not secrets).",
    "⏭️  You can skip this and keep the boilerplate defaults.",
  ])

  const shouldConfigure =
    options.skipConfirm || (await askYesNo("Do you want to configure app environment and link settings?", true))
  if (!shouldConfigure) {
    console.log(chalk.dim("\n   ✅ Skipped. Using current or default values."))
    return false
  }

  const appEnvDefault = defaults.EXPO_PUBLIC_APP_ENV || "development"
  const appEnvChoice = await askChoice("Choose your app environment", [
    { value: "development", label: "Development (local builds, fastest iteration)" },
    { value: "staging", label: "Staging (test environment before release)" },
    { value: "production", label: "Production (live app for users)" },
  ], appEnvDefault)
  services.EXPO_PUBLIC_APP_ENV = appEnvChoice

  console.log(chalk.cyan("\n📧 Email Confirmation Redirect URL"))
  console.log(chalk.dim("   Used in Supabase email confirmation links."))
  console.log(chalk.dim("   💡 Will be updated to use your app scheme automatically"))
  services.EXPO_PUBLIC_EMAIL_REDIRECT_URL = await askQuestion(
    "Enter email confirmation redirect URL (press Enter to keep default)",
    validateUrlOrDeepLink,
    defaults.EXPO_PUBLIC_EMAIL_REDIRECT_URL || "shipnative://verify-email"
  )

  console.log(chalk.cyan("\n🔐 Password Reset Redirect URL"))
  console.log(chalk.dim("   Used in Supabase password reset links."))
  console.log(chalk.dim("   💡 Will be updated to use your app scheme automatically"))
  services.EXPO_PUBLIC_PASSWORD_RESET_REDIRECT_URL = await askQuestion(
    "Enter password reset redirect URL (press Enter to keep default)",
    validateUrlOrDeepLink,
    defaults.EXPO_PUBLIC_PASSWORD_RESET_REDIRECT_URL || "shipnative://reset-password"
  )

  console.log(chalk.cyan("\n🔔 Mock Notifications"))
  console.log(chalk.dim("   Forces mock notifications (no OS permission prompts)."))
  console.log(chalk.dim("   Recommended for development or CI environments."))
  const useMockDefault =
    (defaults.EXPO_PUBLIC_USE_MOCK_NOTIFICATIONS || "false").toLowerCase() === "true"
  const useMock = await askYesNo("Force mock notifications?", useMockDefault)
  services.EXPO_PUBLIC_USE_MOCK_NOTIFICATIONS = useMock ? "true" : "false"

  return true
}

const configureGoogleOAuth = async (
  services: EnvVars,
  defaults: Partial<EnvVars> = {},
  options: SetupOptions = {}
): Promise<boolean> => {
  printSection("🔹 GOOGLE OAUTH (Social Login)", [
    "Let users sign in with their Google account (one-click login).",
    "",
    "💡 Setup guide:",
    "   1. Go to https://console.cloud.google.com/apis/credentials",
    "   2. Create OAuth client IDs for Web + iOS + Android",
    "   3. Add all client IDs in Supabase Auth → Providers → Google (web first)",
    "   4. Enable Skip Nonce Check if using the RN Google Sign-In SDK",
    "",
    "⏭️  You can skip this - users can still sign up with email.",
  ])

  const shouldConfigure = options.skipConfirm || (await askYesNo("Do you want to set up Google sign-in?", false))
  if (!shouldConfigure) {
    console.log(chalk.dim("\n   ✅ Skipped. Users will use email sign-up instead."))
    return false
  }

  console.log(chalk.cyan("\n🔑 Google OAuth Web Client ID"))
  console.log(chalk.dim("   Find this in Google Cloud Console: APIs & Services > Credentials"))
  console.log(chalk.dim("   💡 Leave blank to skip and configure later"))
  services.EXPO_PUBLIC_GOOGLE_CLIENT_ID = await askQuestion(
    "Enter your Google OAuth Web Client ID",
    (id) => !id || id.length > 10,
    defaults.EXPO_PUBLIC_GOOGLE_CLIENT_ID
  )

  console.log(chalk.cyan("\n📱 Google OAuth iOS Client ID"))
  console.log(chalk.dim("   Needed to register the iOS URL scheme for Google Sign-In"))
  console.log(chalk.dim("   💡 Leave blank to skip and configure later"))
  services.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = await askQuestion(
    "Enter your Google OAuth iOS Client ID",
    (id) => !id || id.length > 10,
    defaults.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
  )

  return true
}

const configureAppleSignIn = async (
  services: EnvVars,
  defaults: Partial<EnvVars> = {},
  options: SetupOptions = {}
): Promise<boolean> => {
  printSection("🔹 APPLE SIGN-IN (Social Login)", [
    "Let iOS users sign in with their Apple ID (one-click login on iPhones/iPads).",
    "",
    "💡 Setup guide:",
    "   1. Go to https://developer.apple.com/account/resources/identifiers/list",
    "   2. Create a Services ID",
    "   3. Create a Key for Sign in with Apple",
    "   4. Copy the required values",
    "",
    "⏭️  You can skip this - users can still sign up with email.",
    "⏭️  Only needed if you're releasing on iOS.",
  ])

  const shouldConfigure = options.skipConfirm || (await askYesNo("Do you want to set up Apple sign-in?", false))
  if (!shouldConfigure) {
    console.log(chalk.dim("\n   ✅ Skipped. Users will use email sign-up instead."))
    return false
  }

  console.log(chalk.cyan("\n📋 Apple Services ID"))
  console.log(chalk.dim("   Find this in Apple Developer: Certificates, Identifiers & Profiles > Identifiers"))
  console.log(chalk.dim("   Format: com.yourcompany.appname"))
  console.log(chalk.dim("   💡 Leave blank to skip and configure later"))
  services.EXPO_PUBLIC_APPLE_SERVICES_ID = await askQuestion("Enter your Apple Services ID", (id) => !id || id.includes("."), defaults.EXPO_PUBLIC_APPLE_SERVICES_ID)

  console.log(chalk.cyan("\n👥 Apple Team ID"))
  console.log(chalk.dim("   Find this in Apple Developer: Membership (top right corner)"))
  console.log(chalk.dim("   Format: 10 uppercase letters/numbers (e.g., ABC123DEF4)"))
  console.log(chalk.dim("   💡 Leave blank to skip and configure later"))
  services.EXPO_PUBLIC_APPLE_TEAM_ID = await askQuestion("Enter your Apple Team ID (10 characters)", (id) => {
    if (!id) return true // Allow empty to skip
    return /^[A-Z0-9]{10}$/.test(id.toUpperCase())
  }, defaults.EXPO_PUBLIC_APPLE_TEAM_ID)

  // Show instructions for configuring the private key in the backend dashboard
  console.log(chalk.yellow("\n📋 Important: Apple Private Key Configuration"))
  console.log(chalk.dim("   The Apple Private Key (.p8 file) must be configured in your backend dashboard:"))
  console.log(chalk.dim(""))
  console.log(chalk.dim("   For Supabase users:"))
  console.log(chalk.dim("     1. Go to Supabase Dashboard → Auth → Providers → Apple"))
  console.log(chalk.dim("     2. Enter your Services ID, Team ID, Key ID, and Private Key there"))
  console.log(chalk.dim("     3. The private key stays server-side and is never exposed to the app"))
  console.log(chalk.dim(""))
  console.log(chalk.dim("   For Convex users:"))
  console.log(chalk.dim("     1. Go to Convex Dashboard → Settings → Environment Variables"))
  console.log(chalk.dim("     2. Set AUTH_APPLE_ID and AUTH_APPLE_SECRET"))
  console.log(chalk.dim(""))
  console.log(chalk.dim("   🔒 Security: Private keys should NEVER be stored in client-side environment variables."))

  return true
}

const configurePostHog = async (
  services: EnvVars,
  defaults: Partial<EnvVars> = {},
  options: SetupOptions = {}
): Promise<boolean> => {
  printSection("🔹 POSTHOG (Analytics)", [
    "Track how users use your app - see which features are popular, where users get stuck, etc.",
    "",
    "💡 Free tier available! Sign up at https://us.posthog.com",
    "",
    "⏭️  You can skip this and add analytics later.",
  ])

  const shouldConfigure = options.skipConfirm || (await askYesNo("Do you want to set up analytics tracking with PostHog?", false))
  if (!shouldConfigure) {
    console.log(chalk.dim("\n   ✅ Skipped. You can add analytics later if needed."))
    return false
  }

  console.log(chalk.cyan("\n🔑 PostHog API Key"))
  console.log(chalk.dim("   Find this in PostHog: Project Settings > Project API Key"))
  console.log(chalk.dim("   💡 Leave blank to skip and configure later"))
  services.EXPO_PUBLIC_POSTHOG_API_KEY = await askQuestion("Enter your PostHog API Key", validatePostHogKey, defaults.EXPO_PUBLIC_POSTHOG_API_KEY, true)
  
  console.log(chalk.cyan("\n🌐 PostHog Host"))
  console.log(chalk.dim("   Usually: https://us.i.posthog.com (or https://eu.i.posthog.com for EU)"))
  services.EXPO_PUBLIC_POSTHOG_HOST = await askQuestion("Enter your PostHog Host (or press Enter for default)", validateUrl, defaults.EXPO_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com")

  return true
}

const configureRevenueCat = async (
  services: EnvVars,
  defaults: Partial<EnvVars> = {},
  options: SetupOptions = {}
): Promise<boolean> => {
  printSection("🔹 REVENUECAT (In-App Purchases)", [
    "Sell subscriptions and one-time purchases in your app.",
    "",
    "💡 Free tier available! Sign up at https://app.revenuecat.com",
    "",
    "⏭️  You can skip this if you're not selling anything yet.",
  ])

  const shouldConfigure = options.skipConfirm || (await askYesNo("Do you want to set up in-app purchases?", false))
  if (!shouldConfigure) {
    console.log(chalk.dim("\n   ✅ Skipped. You can add payments later when ready to monetize."))
    return false
  }

  console.log(chalk.cyan("\n📱 Platform Keys"))
  console.log(chalk.dim("   Find these in RevenueCat: Project Settings > API Keys"))
  console.log(chalk.dim("   💡 Tip: You only need to add keys for platforms you're releasing on"))
  console.log(chalk.dim("   💡 Tip: Press Enter to skip any platform you're not using"))
  
  services.EXPO_PUBLIC_REVENUECAT_IOS_KEY = await askQuestion("iOS Public API Key (optional - press Enter to skip)", null, defaults.EXPO_PUBLIC_REVENUECAT_IOS_KEY, true)
  services.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY = await askQuestion("Android Public API Key (optional - press Enter to skip)", null, defaults.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY, true)
  services.EXPO_PUBLIC_REVENUECAT_WEB_KEY = await askQuestion("Web Public API Key (optional - for web version, press Enter to skip)", null, defaults.EXPO_PUBLIC_REVENUECAT_WEB_KEY, true)

  return true
}

const configureSentry = async (
  services: EnvVars,
  defaults: Partial<EnvVars> = {},
  options: SetupOptions = {}
): Promise<boolean> => {
  printSection("🔹 SENTRY (Error Tracking)", [
    "Get notified when your app crashes or has errors. Super helpful for debugging!",
    "",
    "💡 Free tier available! Sign up at https://sentry.io",
    "",
    "⏭️  You can skip this and add error tracking later.",
  ])

  const shouldConfigure = options.skipConfirm || (await askYesNo("Do you want to set up error tracking with Sentry?", false))
  if (!shouldConfigure) {
    console.log(chalk.dim("\n   ✅ Skipped. You can add error tracking later."))
    return false
  }

  console.log(chalk.cyan("\n🔗 Sentry DSN"))
  console.log(chalk.dim("   Find this in Sentry: Settings > Projects > [Your Project] > Client Keys (DSN)"))
  console.log(chalk.dim("   Looks like: https://xxxxx@xxxxx.ingest.sentry.io/xxxxx"))
  console.log(chalk.dim("   💡 Leave blank to skip and configure later"))
  services.EXPO_PUBLIC_SENTRY_DSN = await askQuestion("Enter your Sentry DSN", validateSentryDSN, defaults.EXPO_PUBLIC_SENTRY_DSN)

  return true
}

const configureFCM = async (
  services: EnvVars,
  defaults: Partial<EnvVars> = {},
  options: SetupOptions = {}
): Promise<boolean> => {
  printSection("🔹 FIREBASE CLOUD MESSAGING (Push Notifications)", [
    "Send push notifications to Android users (iOS uses Apple's system automatically).",
    "",
    "💡 Setup guide:",
    "   1. Go to https://console.firebase.google.com/",
    "   2. Create a project or use existing one",
    "   3. Download google-services.json for your Android app",
    "   4. Place it in: apps/app/android/app/google-services.json",
    "",
    "⚠️  Note: The legacy 'Server Key' is deprecated by Firebase.",
    "   Push notifications are sent server-side using the FCM HTTP v1 API.",
    "   Your Supabase Edge Functions or Convex functions handle this automatically.",
    "",
    "⏭️  You can skip this - notifications will still work on iOS.",
    "⏭️  Only needed if you're releasing on Android.",
  ])

  const shouldConfigure = options.skipConfirm || (await askYesNo("Do you want to set up push notifications for Android?", false))
  if (!shouldConfigure) {
    console.log(chalk.dim("\n   ✅ Skipped. Push notifications will work on iOS automatically."))
    return false
  }

  console.log(chalk.yellow("\n📥 Firebase Configuration for Android"))
  console.log(chalk.dim("   1. Go to Firebase Console: https://console.firebase.google.com/"))
  console.log(chalk.dim("   2. Select your project (or create one)"))
  console.log(chalk.dim("   3. Add an Android app with your package name"))
  console.log(chalk.dim("   4. Download google-services.json"))
  console.log(chalk.dim("   5. Place it in: apps/app/android/app/google-services.json"))
  console.log(chalk.dim(""))
  console.log(chalk.yellow("📋 Server-side Push Notification Setup"))
  console.log(chalk.dim("   Push notifications are sent from your backend, not the app."))
  console.log(chalk.dim(""))
  console.log(chalk.dim("   For Supabase users:"))
  console.log(chalk.dim("     • Use Supabase Edge Functions to send notifications"))
  console.log(chalk.dim("     • Store Firebase service account JSON in Supabase secrets"))
  console.log(chalk.dim("     • See: supabase/functions/push-notification/"))
  console.log(chalk.dim(""))
  console.log(chalk.dim("   For Convex users:"))
  console.log(chalk.dim("     • Use Convex actions to send notifications"))
  console.log(chalk.dim("     • Store Firebase credentials in Convex environment variables"))
  console.log(chalk.dim(""))
  console.log(chalk.dim("   🔒 Security: Firebase credentials stay server-side only."))

  return true
}

const configureWidgets = async (
  services: EnvVars,
  defaults: Partial<EnvVars> = {},
  options: SetupOptions = {}
): Promise<boolean> => {
  printSection("🔹 NATIVE WIDGETS (iOS & Android)", [
    "Enable native home screen widgets for iOS and Android.",
    "Widgets can display data from Supabase and update automatically.",
    "Requires native code generation (prebuild) after enabling.",
    "",
    "⚠️  iOS widgets require an Apple Developer account ($99/year) for code signing.",
    "   Android widgets work without any paid account.",
  ])

  const shouldConfigure = options.skipConfirm || (await askYesNo("Do you want to enable native widgets?", false))
  if (!shouldConfigure) {
    if (services.EXPO_PUBLIC_ENABLE_WIDGETS === undefined) {
      // Don't set it if it's not in the env, let it default to false
    }
    return false
  }

  services.EXPO_PUBLIC_ENABLE_WIDGETS = "true"

  console.log(chalk.cyan("\n👥 Apple Team ID (iOS)"))
  console.log(chalk.dim("   Required for iOS widget code signing."))
  console.log(chalk.dim("   Find this in Apple Developer: Membership (top right corner)"))
  console.log(chalk.dim("   Format: 10 uppercase letters/numbers (e.g., ABC123DEF4)"))
  console.log(chalk.dim("   💡 Leave empty to skip iOS widgets (Android will still work)"))
  const appleTeamId = await askQuestion(
    "Enter your Apple Team ID (or press Enter to skip iOS)",
    (id) => !id || /^[A-Z0-9]{10}$/.test(id.toUpperCase()),
    defaults.APPLE_TEAM_ID || process.env.APPLE_TEAM_ID || ""
  )
  if (appleTeamId) {
    services.APPLE_TEAM_ID = appleTeamId.toUpperCase()
  }

  console.log(chalk.cyan("\n🧩 App Group (iOS)"))
  console.log(chalk.dim("   Used for sharing data between the app and the widget extension."))
  console.log(chalk.dim("   Format: group.com.yourcompany.yourapp"))
  services.APP_GROUP_IDENTIFIER = await askQuestion(
    "Enter your iOS App Group identifier",
    (id) => id.startsWith("group.") && id.split(".").length >= 3,
    defaults.APP_GROUP_IDENTIFIER || process.env.APP_GROUP_IDENTIFIER || "group.com.reactnativestarterkit"
  )

  console.log("\n✅ Widgets enabled!")
  if (appleTeamId) {
    console.log("   📱 iOS widgets: Ready (requires Apple Developer account)")
  } else {
    console.log("   📱 iOS widgets: Skipped (no Apple Team ID)")
  }
  console.log("   🤖 Android widgets: Ready")
  console.log("   💡 After setup, run 'yarn prebuild:clean' to generate native code")
  console.log("   📖 See docs/WIDGETS.md for widget development guide")

  return true
}

// Services catalog without backend (backend is handled separately to allow dynamic selection)
const servicesCatalogWithoutBackend: ServiceCatalogEntry[] = [
  { key: "appEnv", label: "App Environment & Links", handler: configureAppEnvironment },
  { key: "google", label: "Google OAuth (Social Login)", handler: configureGoogleOAuth },
  { key: "apple", label: "Apple Sign-In (Social Login)", handler: configureAppleSignIn },
  { key: "posthog", label: "PostHog (Analytics)", handler: configurePostHog },
  { key: "revenuecat", label: "RevenueCat (Monetization)", handler: configureRevenueCat },
  { key: "sentry", label: "Sentry (Error Tracking)", handler: configureSentry },
  { key: "fcm", label: "Firebase Cloud Messaging (Push)", handler: configureFCM },
  { key: "widgets", label: "Native Widgets (iOS & Android)", handler: configureWidgets },
]

// Full catalog including backend options (for menu mode)
const getServicesCatalogForProvider = (provider: BackendProvider): ServiceCatalogEntry[] => {
  const backendService: ServiceCatalogEntry = provider === "supabase"
    ? { key: "supabase", label: "Supabase (Backend & Auth)", handler: configureSupabase }
    : { key: "convex", label: "Convex (Backend & Auth)", handler: configureConvex }

  return [
    { key: "appEnv", label: "App Environment & Links", handler: configureAppEnvironment },
    backendService,
    ...servicesCatalogWithoutBackend.slice(1), // Skip appEnv since it's already included
  ]
}

const configureServicesSequentially = async (
  services: EnvVars,
  defaults: Partial<EnvVars>,
  options: SetupOptions = {}
): Promise<number> => {
  let configuredCount = 0

  // Step 1: Choose backend provider first
  const backendProvider = await configureBackendProvider(services, defaults, options)
  configuredCount += 1

  // Step 2: Configure the selected backend
  if (backendProvider === "supabase") {
    const configured = await configureSupabase(services, defaults, options)
    if (configured) configuredCount += 1
  } else {
    const configured = await configureConvex(services, defaults, options)
    if (configured) configuredCount += 1
  }

  // Step 3: Configure app environment (always required)
  const appEnvService = servicesCatalogWithoutBackend[0]
  const appEnvConfigured = await appEnvService.handler(services, defaults, options)
  if (appEnvConfigured) configuredCount += 1

  // Step 4: Let user select which optional services to configure
  const optionalServices = servicesCatalogWithoutBackend.slice(1) // Skip appEnv

  if (!isNonInteractive && !options.skipConfirm) {
    console.log(chalk.cyan("\n📦 Optional Services"))
    console.log(chalk.dim("   Select which services you want to configure now."))
    console.log(chalk.dim("   Use ↑↓ to move, SPACE to select, ENTER to confirm."))
    console.log(chalk.dim("   You can always add more services later by running 'yarn setup' again.\n"))

    const selectedServiceKeys = await askMultiChoice(
      "Which services do you want to configure?",
      optionalServices.map(service => ({
        value: service.key,
        label: service.label,
        checked: false, // None pre-selected by default
      }))
    )

    if (selectedServiceKeys.length === 0) {
      console.log(chalk.green("\n✅ No optional services selected. Your app is ready to go!"))
      console.log(chalk.dim("   Run 'yarn setup' anytime to add more services.\n"))
    } else {
      console.log(chalk.cyan(`\n🔧 Configuring ${selectedServiceKeys.length} selected service(s)...\n`))

      // Configure only the selected services
      for (const serviceKey of selectedServiceKeys) {
        const service = optionalServices.find(s => s.key === serviceKey)
        if (service) {
          const configured = await service.handler(services, defaults, { ...options, skipConfirm: true })
          if (configured) configuredCount += 1
        }
      }
    }
  } else {
    // Non-interactive mode: go through all services
    for (const service of optionalServices) {
      const configured = await service.handler(services, defaults, options)
      if (configured) configuredCount += 1
    }
  }

  return configuredCount
}

const runServiceMenu = async (services: EnvVars, defaults: Partial<EnvVars>): Promise<number> => {
  let configuredCount = 0

  // First, select backend provider if not already set
  if (!services.EXPO_PUBLIC_BACKEND_PROVIDER) {
    const provider = await configureBackendProvider(services, defaults, {})
    configuredCount += 1
    console.log(chalk.green(`\n✅ Backend set to ${provider}. Now configure your services.\n`))
  }

  const currentProvider = (services.EXPO_PUBLIC_BACKEND_PROVIDER || "supabase") as BackendProvider
  const servicesCatalog = getServicesCatalogForProvider(currentProvider)

  while (true) {
    const choice = await askChoice("Which service would you like to configure next?", [
      { value: "change-backend", label: `🔄 Change backend (currently: ${currentProvider})` },
      ...servicesCatalog.map((service) => ({
        value: service.key,
        label: service.label,
      })),
      { value: "done", label: "Done configuring services" },
    ])

    if (choice === "done") {
      break
    }

    if (choice === "change-backend") {
      const newProvider = await configureBackendProvider(services, defaults, {})
      if (newProvider !== currentProvider) {
        // Clear old backend config
        if (newProvider === "convex") {
          delete services.EXPO_PUBLIC_SUPABASE_URL
          delete services.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
        } else {
          delete services.EXPO_PUBLIC_CONVEX_URL
        }
        console.log(chalk.green(`\n✅ Backend changed to ${newProvider}.\n`))
      }
      continue
    }

    const selected = servicesCatalog.find((service) => service.key === choice)
    if (selected) {
      const configured = await selected.handler(services, defaults, { skipConfirm: true })
      if (configured) configuredCount += 1
    }
  }
  return configuredCount
}

const configureMarketingPage = async (
  marketingEnv: EnvVars = {}
): Promise<{ updated: boolean; env: EnvVars; requested: boolean }> => {
  printSection("🌐 MARKETING PAGE (apps/web)", [
    "Configure the marketing site mode and Supabase Edge Function endpoint for the waitlist form.",
    "Updates apps/web/.env so `yarn web` and deployments pick up the right values.",
    "",
    "Note: Resend API key is now stored securely in Supabase Edge Function secrets, not in the frontend.",
  ])

  const shouldConfigure = await askYesNo("Do you want to configure the marketing page now?", true)
  if (!shouldConfigure) return { updated: false, env: marketingEnv, requested: false }

  const currentMode = marketingEnv.VITE_MODE || "waitlist"
  const selectedMode = await askChoice(
    "Choose marketing page mode",
    [
      { value: "waitlist", label: "Waitlist (collect emails before launch)" },
      { value: "launch", label: "Launch (promote your live app)" },
    ],
    currentMode
  )

  const currentEndpoint = marketingEnv.VITE_WAITLIST_API_ENDPOINT || ""
  const endpointInput = await askQuestion("Supabase Edge Function endpoint for waitlist (e.g., https://your-project.supabase.co/functions/v1/waitlist)", null, currentEndpoint)
  const resolvedEndpoint = endpointInput || currentEndpoint

  const updatedEnv = { ...marketingEnv, VITE_MODE: selectedMode }
  if (resolvedEndpoint) {
    updatedEnv.VITE_WAITLIST_API_ENDPOINT = resolvedEndpoint
  } else {
    delete updatedEnv.VITE_WAITLIST_API_ENDPOINT
  }

  // Remove RESEND_API_KEY if it exists (no longer used in frontend)
  delete updatedEnv.RESEND_API_KEY

  const updated = selectedMode !== currentMode || resolvedEndpoint !== currentEndpoint

  return { updated, env: updatedEnv, requested: true }
}

// ========================================
// MAIN SETUP
// ========================================
async function setup(): Promise<void> {
  try {
    // Check prerequisites
    await checkPrerequisites()

    // Welcome banner
    const welcomeBanner = boxen(
      chalk.bold.cyan("🚀 Welcome to Shipnative Setup!") +
        "\n\n" +
        chalk.dim("We'll help you configure your app step-by-step.") +
        "\n" +
        chalk.dim("💡 Don't worry - you can skip anything and add it later!") +
        "\n" +
        chalk.dim("💡 Press Enter to use suggested default values."),
      {
        padding: 1,
        borderColor: "cyan",
        borderStyle: "round",
        title: "Welcome",
        titleAlignment: "center",
      }
    )
    console.log("\n" + welcomeBanner + "\n")

    const appEnvPath = path.join(__dirname, "apps/app/.env")
    const existingAppEnvData = loadEnvFileWithComments(appEnvPath)
    const existingAppEnv = existingAppEnvData.vars
    const marketingEnvPath = path.join(__dirname, "apps/web/.env")
    const marketingEnvExists = fs.existsSync(marketingEnvPath)
    const marketingEnvData = loadEnvFileWithComments(marketingEnvPath)
    const marketingEnv: EnvVars = marketingEnvData.vars
    const metadataDefaults = getMetadataDefaults()
    const config: Partial<MetadataConfig> = {}
    const services: EnvVars = { ...existingAppEnv }

    // Migrate legacy anon key input to publishable key and drop the old variable name
    if (services.EXPO_PUBLIC_SUPABASE_ANON_KEY && !services.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
      services.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = services.EXPO_PUBLIC_SUPABASE_ANON_KEY
    }
    delete services.EXPO_PUBLIC_SUPABASE_ANON_KEY
    const serviceDefaults: Partial<EnvVars> = { ...services }

    const isDryRun = process.argv.includes("--dry-run")
    if (isDryRun) {
      console.log("🔍 DRY RUN MODE: No changes will be applied\n")
    }

    console.log(chalk.cyan("\n🎯 Choose Your Setup Path:\n"))
    const mode = await askChoice("How would you like to set up your app?", [
      {
        value: "wizard",
        label: "✨ Guided Wizard (Recommended) - We'll walk you through everything step-by-step",
      },
      {
        value: "service-menu",
        label: "⚙️  Service Configurator - Pick and configure services one at a time",
      },
      {
        value: "metadata-only",
        label: "📱 Just Update App Info - Change app name, bundle ID, etc. (skip services)",
      },
      { value: "exit", label: "❌ Exit - I'll set this up later" },
    ])

    if (mode === "exit") {
      console.log(chalk.dim("\n👋 No changes made. Run `yarn setup` again when you're ready.\n"))
      process.exit(0)
    }

    let metadataConfigured = false
    let servicesConfigured = 0

    if (mode === "wizard") {
      console.log(chalk.green("\n✨ Great choice! Let's set up your app together.\n"))
      console.log(chalk.dim("We'll start with basic app information, then go through optional services."))
      console.log(chalk.dim("Remember: You can skip any service and add it later!\n"))
      metadataConfigured = await configureMetadata(config, metadataDefaults)
      servicesConfigured = await configureServicesSequentially(services, serviceDefaults)
    } else if (mode === "service-menu") {
      console.log(chalk.cyan("\n⚙️  Service Configurator"))
      console.log(chalk.dim("Pick which service you'd like to configure. You can come back anytime!\n"))
      servicesConfigured = await runServiceMenu(services, serviceDefaults)
    } else if (mode === "metadata-only") {
      console.log(chalk.cyan("\n📱 App Metadata Setup"))
      console.log(chalk.dim("Let's update your app's basic information.\n"))
      metadataConfigured = await configureMetadata(config, metadataDefaults)
    }

    const { env: updatedMarketingEnv, updated: marketingUpdated, requested: marketingRequested } = await configureMarketingPage(marketingEnv)

    // ========================================
    // CLEANUP UNUSED BACKEND CODE & DEPENDENCIES
    // ========================================
    const selectedBackend = (services.EXPO_PUBLIC_BACKEND_PROVIDER || "supabase") as BackendProvider
    let backendCodeRemoved = false
    let packagesRemoved = false
    if (!isDryRun && services.EXPO_PUBLIC_BACKEND_PROVIDER) {
      backendCodeRemoved = await removeUnusedBackendCode(selectedBackend)
      if (backendCodeRemoved) {
        // Also clean up .env.example and package dependencies
        updateEnvExample(selectedBackend)
        packagesRemoved = removeUnusedBackendPackages(selectedBackend)
      }
    }

    // ========================================
    // APPLY CHANGES
    // ========================================
    if (!isDryRun) {
      printSection("💾 APPLYING CONFIGURATION")

      const appJsonPath = path.join(__dirname, "apps/app/app.json")
      const appPackageJsonPath = path.join(__dirname, "apps/app/package.json")

      if (metadataConfigured) {
        console.log("\n📝 Updating app.json...")
        if (fs.existsSync(appJsonPath)) {
          const backupPath = backupFile(appJsonPath)
          if (backupPath) {
            console.log(`   💾 Backup created: ${path.relative(__dirname, backupPath)}`)
          }

          try {
            const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf8"))
            const configRoot = appJson.expo || appJson

            configRoot.name = config.displayName
            configRoot.slug = config.projectName
            configRoot.scheme = config.scheme

            if (!configRoot.ios) configRoot.ios = {}
            configRoot.ios.bundleIdentifier = config.bundleId

            if (!configRoot.android) configRoot.android = {}
            configRoot.android.package = config.bundleId

            fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2))
            console.log("   ✅ app.json updated")
          } catch (error) {
            handleError(error, {
              step: "updating app.json",
              file: appJsonPath,
              suggestion: "Check that app.json is valid JSON",
            })
          }
        } else {
          console.log("   ⚠️ app.json not found at apps/app/app.json - skipping metadata update")
        }

        if (fs.existsSync(appPackageJsonPath)) {
          console.log("\n📝 Updating apps/app/package.json...")
          const backupPath = backupFile(appPackageJsonPath)
          if (backupPath) {
            console.log(`   💾 Backup created: ${path.relative(__dirname, backupPath)}`)
          }

          try {
            const packageJson = JSON.parse(fs.readFileSync(appPackageJsonPath, "utf8"))
            packageJson.name = config.projectName
            fs.writeFileSync(appPackageJsonPath, JSON.stringify(packageJson, null, 2))
            console.log("   ✅ apps/app/package.json updated")
          } catch (error) {
            handleError(error, {
              step: "updating package.json",
              file: appPackageJsonPath,
              suggestion: "Check that package.json is valid JSON",
            })
          }
        } else {
          console.log("   ⚠️ package.json not found at apps/app/package.json - skipping package update")
        }
      } else {
        console.log("\nℹ️ Skipping app metadata updates (not selected in this run)")
      }

      if (servicesConfigured > 0 || Object.keys(services).length > 0) {
        // Update redirect URLs to use the user's scheme (not hardcoded "shipnative")
        const effectiveScheme = config.scheme || metadataDefaults.scheme || "shipnative"
        if (services.EXPO_PUBLIC_EMAIL_REDIRECT_URL?.includes("shipnative://") && effectiveScheme !== "shipnative") {
          services.EXPO_PUBLIC_EMAIL_REDIRECT_URL = services.EXPO_PUBLIC_EMAIL_REDIRECT_URL.replace("shipnative://", `${effectiveScheme}://`)
        }
        if (services.EXPO_PUBLIC_PASSWORD_RESET_REDIRECT_URL?.includes("shipnative://") && effectiveScheme !== "shipnative") {
          services.EXPO_PUBLIC_PASSWORD_RESET_REDIRECT_URL = services.EXPO_PUBLIC_PASSWORD_RESET_REDIRECT_URL.replace("shipnative://", `${effectiveScheme}://`)
        }

        console.log("\n📝 Updating .env with service settings...")
        const backupPath = backupFile(appEnvPath)
        if (backupPath) {
          console.log(`   💾 Backup created: ${path.relative(__dirname, backupPath)}`)
        }

        writeEnvFile(appEnvPath, services)
        console.log(`   ✅ .env file updated at apps/app/.env (${Object.keys(services).length} entries)`)

        // Security warning
        warnAboutEnvSecurity(appEnvPath)
      } else if (Object.keys(existingAppEnv).length > 0) {
        console.log("\nℹ️ No service changes captured - leaving existing apps/app/.env untouched")
      } else {
        console.log("\n💡 No services configured - app will run in MOCK mode")
      }

      if (marketingRequested) {
        if (marketingUpdated || !marketingEnvExists) {
          const backupPath = backupFile(marketingEnvPath)
          if (backupPath) {
            console.log(`   💾 Backup created: ${path.relative(__dirname, backupPath)}`)
          }

          writeEnvFile(marketingEnvPath, updatedMarketingEnv)
          console.log(`\n📝 Marketing page env updated at apps/web/.env (${Object.keys(updatedMarketingEnv).length} entries)`)
        } else {
          console.log("\nℹ️ Marketing page env unchanged (already up to date)")
        }
      } else {
        console.log("\nℹ️ Skipping marketing page env configuration (not selected this run)")
      }

      // Generate setup summary
      const summaryPath = generateSetupSummary(config, services, metadataConfigured, servicesConfigured)
      if (summaryPath) {
        console.log(`\n📋 Setup summary saved to: ${path.relative(__dirname, summaryPath)}`)
      }

      // CRITICAL: When package.json changes, yarn install MUST run to regenerate yarn.lock
      // This happens when: metadata changes (project name) OR when backend packages are removed
      const needsYarnInstall = (metadataConfigured && config.projectName) || packagesRemoved
      if (needsYarnInstall) {
        const reason = packagesRemoved
          ? "Backend packages removed"
          : "Package name changed"
        console.log(chalk.yellow(`\n⚠️  ${reason} - regenerating yarn.lock...`))
        console.log(chalk.dim("   This is required to update dependencies."))
        const stopSpinner = createSpinner("Running yarn install to regenerate yarn.lock")
        try {
          execSync("yarn install", { stdio: "inherit", cwd: __dirname })
          stopSpinner(true)
        } catch (error) {
          stopSpinner(false)
          console.error(chalk.red("   ❌ Failed to regenerate yarn.lock"))
          console.error(chalk.yellow("   ⚠️  Run 'yarn install' manually before building"))
        }
      }
    } else {
      console.log("\n🔍 DRY RUN - Preview of changes:")
      console.log("\n📝 Would update app.json with:")
      console.log(`   • Display Name: ${config.displayName || "(unchanged)"}`)
      console.log(`   • Project Name: ${config.projectName || "(unchanged)"}`)
      console.log(`   • Bundle ID: ${config.bundleId || "(unchanged)"}`)
      console.log(`   • Scheme: ${config.scheme || "(unchanged)"}`)
      console.log("\n📝 Would update .env with:")
      console.log(`   • ${Object.keys(services).length} environment variables`)
      Object.entries(services).forEach(([key, value]) => {
        const isSecretKey = key.toLowerCase().includes("key") || key.toLowerCase().includes("secret") || key.toLowerCase().includes("password")
        const masked = isSecretKey ? "***" : value
        console.log(`   • ${key}=${masked}`)
      })
      console.log("\n💡 Run without --dry-run to apply these changes")
    }

    // Offer to regenerate native projects when metadata changed
    const shouldOfferPrebuild = metadataConfigured && !isDryRun
    if (shouldOfferPrebuild) {
      const runPrebuild = await askYesNo(
        "\nRun `yarn prebuild:clean` now to regenerate native projects with the updated name/bundle IDs?",
        false
      )
      if (runPrebuild) {
        const stopSpinner = createSpinner("Running yarn prebuild:clean")
        try {
          execSync("yarn prebuild:clean", { stdio: "inherit" })
          stopSpinner(true)
        } catch (error) {
          stopSpinner(false)
          console.error("   ❌ Failed to run `yarn prebuild:clean`")
          console.error("   Please run `yarn prebuild:clean` manually before the next build.")
        }
      }
    }

    // Offer to install dependencies only when services changed (not metadata - that's handled above)
    const shouldOfferInstall = !metadataConfigured && servicesConfigured > 0 && !isDryRun
    if (shouldOfferInstall) {
      printSection("📦 DEPENDENCIES")
      const shouldInstall = await askYesNo("\nDo you want to install dependencies now? (yarn install)", true)
      if (shouldInstall) {
        const stopSpinner = createSpinner("Installing dependencies (this may take a few minutes)")
        try {
          execSync("yarn install", { stdio: "inherit" })
          stopSpinner(true)
        } catch (error) {
          stopSpinner(false)
          console.error("   ❌ Failed to install dependencies")
          console.error("   Please run 'yarn install' manually")
        }
      }
    }

    // ========================================
    // COMPLETION
    // ========================================
    const serviceStatus = getServiceStatus(services)
    const configuredServices = formatServiceList(serviceStatus, true)
    const mockServices = formatServiceList(serviceStatus, false)
    const totalServices = Object.keys(serviceStatus).length

    const effectiveConfig = {
      displayName: config.displayName || metadataDefaults.displayName || "My Shipnative App",
      bundleId: config.bundleId || metadataDefaults.bundleId || "com.shipnative.app",
      scheme: config.scheme || metadataDefaults.scheme || "shipnativeapp",
      projectName: config.projectName || metadataDefaults.projectName || "shipnative-app",
    }

    // Completion banner
    const completionBanner = boxen(
      chalk.bold.green("🎉 SETUP COMPLETE!") +
        "\n\n" +
        chalk.dim("Your Shipnative project is ready to go."),
      {
        padding: 1,
        borderColor: "green",
        borderStyle: "round",
        title: "Success",
        titleAlignment: "center",
      }
    )
    console.log("\n" + completionBanner + "\n")

    console.log(chalk.bold("📚 Important Documentation Files:\n"))
    console.log(chalk.cyan("📖 Getting Started:"))
    console.log(chalk.dim("   • README.md - Main documentation and quick start"))
    console.log(chalk.dim("   • apps/app/vibe/CONTEXT.md - App architecture"))
    console.log(chalk.dim("   • apps/app/vibe/TECH_STACK.md - Technologies used"))
    console.log(chalk.dim("   • apps/app/vibe/STYLE_GUIDE.md - Code patterns"))

    console.log(chalk.cyan("\n🔧 Setup & Integration:"))
    const backendProvider = services.EXPO_PUBLIC_BACKEND_PROVIDER || "supabase"
    if (backendProvider === "convex") {
      console.log(chalk.dim("   • docs/CONVEX.md - Auth and database (Convex)"))
    } else {
      console.log(chalk.dim("   • docs/SUPABASE.md - Auth and database (Supabase)"))
    }
    console.log(chalk.dim("   • docs/MONETIZATION.md - Payments (RevenueCat for iOS, Android & Web)"))
    console.log(chalk.dim("   • docs/ANALYTICS.md - PostHog and Sentry"))
    console.log(chalk.dim("   • docs/NOTIFICATIONS.md - Push notifications"))
    console.log(chalk.dim("   • docs/DESIGN_SYSTEM.md - UI components"))

    console.log(chalk.cyan("\n🚀 Deployment:"))
    console.log(chalk.dim("   • docs/DEPLOYMENT.md - iOS, Android, Web deployment"))
    console.log(chalk.dim("   • docs/TROUBLESHOOTING.md - Common issues"))

    console.log(chalk.bold("\n🔗 Your Configuration:"))
    console.log(
      `   • Display Name: ${chalk.green(effectiveConfig.displayName)}${metadataConfigured ? "" : chalk.dim(" (unchanged)")}`
    )
    console.log(
      `   • Bundle ID: ${chalk.green(effectiveConfig.bundleId)}${metadataConfigured ? "" : chalk.dim(" (unchanged)")}`
    )
    console.log(
      `   • URL Scheme: ${chalk.green(effectiveConfig.scheme + "://")}${metadataConfigured ? "" : chalk.dim(" (unchanged)")}`
    )
    console.log(
      `   • Backend: ${chalk.green(backendProvider === "convex" ? "Convex" : "Supabase")}`
    )
    console.log(
      `   • Services configured: ${chalk.green(`${configuredServices.length} / ${totalServices}`)}${configuredServices.length ? chalk.dim(` (${configuredServices.join(", ")})`) : chalk.dim(" (all in mock mode)")}`
    )
    if (mockServices.length) {
      console.log(chalk.yellow(`   • Mock mode: ${mockServices.join(", ")}`))
    }
    if (marketingRequested) {
      console.log(chalk.cyan("\n🌐 Marketing page:"))
      console.log(`   • Mode: ${chalk.green(updatedMarketingEnv.VITE_MODE || "waitlist")}`)
      console.log(
        `   • Waitlist endpoint: ${updatedMarketingEnv.VITE_WAITLIST_API_ENDPOINT ? chalk.green("configured") : chalk.dim("not set")}`
      )
    }

    console.log(chalk.bold("\n💡 Next Steps:"))
    console.log(chalk.dim("   1. cd apps/app"))
    console.log(chalk.dim("   2. yarn ios  (or yarn android)"))
    console.log(chalk.dim("   3. Check the Dev Dashboard in the app"))
    if (backendProvider === "convex") {
      console.log(chalk.dim("   4. Run 'npx convex dev' to start your Convex backend"))
      console.log(chalk.dim("   5. Read docs/CONVEX.md to set up authentication"))
    } else {
      console.log(chalk.dim("   4. Read docs/SUPABASE.md to set up your database"))
      console.log(chalk.dim("   5. Read docs/MONETIZATION.md to configure subscriptions (RevenueCat)"))
    }

    console.log(chalk.bold("\n🤖 AI-Assisted Development:"))
    console.log(chalk.dim('   Use this prompt in Cursor/Claude:'))
    console.log(chalk.dim('   "I am ready to vibe. Read the .cursorrules and the vibe/ folder.'))
    console.log(chalk.dim('   I want to build a [Description of App]. Start by outlining'))
    console.log(chalk.dim('   the database schema changes I need."'))

    console.log(chalk.bold("\n🔗 Test Deep Linking:"))
    console.log(chalk.dim(`   Dev build:  xcrun simctl openurl booted "exp+${effectiveConfig.scheme}://profile"`))
    console.log(chalk.dim(`   Prod build: xcrun simctl openurl booted "${effectiveConfig.scheme}://profile"`))

    console.log(chalk.green.bold("\n" + repeatLine("=")))
    console.log(chalk.green.bold("Happy coding! 🚀"))
    console.log(chalk.green.bold(repeatLine("=") + "\n"))

    process.exit(0)
  } catch (error) {
    handleError(error, { step: "setup" })
    process.exit(1)
  }
}

// Run setup
setup().catch((error) => {
  handleError(error, { step: "setup" })
  process.exit(1)
})
