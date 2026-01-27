#!/usr/bin/env node

/**
 * Pre-flight check script
 * Ensures yarn install and yarn setup have been run before starting dev commands
 */

const fs = require("fs")
const path = require("path")

const repoRoot = path.resolve(__dirname, "..")
const nodeModulesPath = path.join(repoRoot, "node_modules")
const appEnvPath = path.join(repoRoot, "apps/app/.env")

let hasErrors = false

// Check if node_modules exists (yarn install was run)
if (!fs.existsSync(nodeModulesPath)) {
  console.error("\n\x1b[31m❌ Dependencies not installed!\x1b[0m")
  console.error("\x1b[33m   Run 'yarn install' first to install dependencies.\x1b[0m\n")
  hasErrors = true
}

// Check if .env exists and has required variables (yarn setup was run)
if (!fs.existsSync(appEnvPath)) {
  console.error("\n\x1b[31m❌ Setup not completed!\x1b[0m")
  console.error("\x1b[33m   Run 'yarn setup' first to configure your app.\x1b[0m\n")
  hasErrors = true
} else {
  // Check if the env file has the backend provider set (indicates setup was run)
  const envContent = fs.readFileSync(appEnvPath, "utf8")
  if (!envContent.includes("EXPO_PUBLIC_BACKEND_PROVIDER")) {
    console.error("\n\x1b[31m❌ Setup incomplete!\x1b[0m")
    console.error("\x1b[33m   The setup wizard hasn't been completed.\x1b[0m")
    console.error("\x1b[33m   Run 'yarn setup' to configure your app.\x1b[0m\n")
    hasErrors = true
  }
}

if (hasErrors) {
  console.error("\x1b[36m📖 Quick Start:\x1b[0m")
  console.error("   1. yarn install")
  console.error("   2. yarn setup")
  console.error("   3. yarn app:start\n")
  process.exit(1)
}

// All checks passed, continue silently
process.exit(0)
