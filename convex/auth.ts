/**
 * Convex Auth Configuration
 *
 * Configure authentication providers for your app.
 * This is the equivalent of Supabase Auth configuration.
 *
 * OAuth token validation:
 * Token verification (id_token signature checks, audience/issuer validation,
 * code exchange, nonce checks) is delegated entirely to Convex Auth's built-in
 * providers via `convexAuth({ providers: [...] })`. Each provider in the
 * `providers` array (Google, Apple, GitHub, Password, Email) implements its
 * own verification contract — we do not re-implement it here.
 *
 * If you extend this file, do NOT add custom token-trust logic (e.g. accepting
 * a raw `id_token` from the client and creating a session) without first
 * understanding the verification contract of the underlying provider. Skipping
 * verification turns your app into an open authentication oracle.
 *
 * Learn more: https://labs.convex.dev/auth
 */

import { convexAuth } from "@convex-dev/auth/server"
import { Password } from "@convex-dev/auth/providers/Password"
import { Email } from "@convex-dev/auth/providers/Email"
import Google from "@auth/core/providers/google"
import Apple from "@auth/core/providers/apple"
import GitHub from "@auth/core/providers/github"
import { Resend } from "resend"

/**
 * Resend email client for sending OTP/Magic Link emails
 * Requires: RESEND_API_KEY environment variable
 */
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const appName = process.env.APP_NAME || "ShipNative"
const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@shipnative.com"

/**
 * Convex Auth configuration
 *
 * Available providers:
 * - Password: Email/password authentication with optional email verification
 * - ResendOTP: Magic link / OTP via Resend email service
 * - Google: OAuth with Google
 * - Apple: OAuth with Apple (Sign in with Apple)
 * - GitHub: OAuth with GitHub
 *
 * Environment variables required (set via `npx convex env set`):
 * - RESEND_API_KEY: For magic link/OTP emails
 * - AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET: For Google OAuth
 * - AUTH_APPLE_ID, AUTH_APPLE_SECRET: For Apple OAuth
 * - AUTH_GITHUB_ID, AUTH_GITHUB_SECRET: For GitHub OAuth
 */
export const { auth, signIn, signOut, store } = convexAuth({
  providers: [
    // =========================================================================
    // Email/Password Authentication
    // Supports: signUp, signIn, password reset, email verification
    // =========================================================================
    Password({
      // Optional: Require email verification before allowing sign in
      // verify: true,

      // Optional: Custom profile creation
      // profile: (email, password) => ({ email }),
    }),

    // =========================================================================
    // Magic Link / OTP via Resend
    // Requires: RESEND_API_KEY environment variable
    // Usage: signIn("resend", { email: "user@example.com" })
    // =========================================================================
    Email({
      id: "resend",
      apiKey: process.env.RESEND_API_KEY,
      async sendVerificationRequest({ identifier: email, url, token }) {
        if (!resend) {
          console.error("RESEND_API_KEY not configured - cannot send OTP email")
          throw new Error("Email service not configured")
        }

        await resend.emails.send({
          from: `${appName} <${fromEmail}>`,
          to: email,
          subject: `Your ${appName} verification code`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #333; font-size: 24px;">Verify your email</h1>
              <p style="color: #666; font-size: 16px;">
                Enter this code to sign in to ${appName}:
              </p>
              <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; margin: 24px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">
                  ${token}
                </span>
              </div>
              <p style="color: #999; font-size: 14px;">
                This code expires in 15 minutes. If you didn't request this, you can safely ignore this email.
              </p>
              <p style="color: #999; font-size: 14px;">
                Or click this link: <a href="${url}">${url}</a>
              </p>
            </div>
          `,
          text: `Your ${appName} verification code is: ${token}\n\nOr click this link: ${url}\n\nThis code expires in 15 minutes.`,
        })
      },
    }),

    // =========================================================================
    // Google OAuth
    // Requires: AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET environment variables
    // Set via: npx convex env set AUTH_GOOGLE_ID <id>
    //          npx convex env set AUTH_GOOGLE_SECRET <secret>
    // =========================================================================
    Google,

    // =========================================================================
    // Apple OAuth (Sign in with Apple)
    // Requires: AUTH_APPLE_ID, AUTH_APPLE_SECRET environment variables
    // Set via: npx convex env set AUTH_APPLE_ID <id>
    //          npx convex env set AUTH_APPLE_SECRET <secret>
    // =========================================================================
    Apple,

    // =========================================================================
    // GitHub OAuth
    // Requires: AUTH_GITHUB_ID, AUTH_GITHUB_SECRET environment variables
    // Set via: npx convex env set AUTH_GITHUB_ID <id>
    //          npx convex env set AUTH_GITHUB_SECRET <secret>
    // =========================================================================
    GitHub,
  ],
  callbacks: {
    // Validate redirect URIs for OAuth flows (mobile app deep links + web)
    async redirect({ redirectTo }) {
      // Log for debugging
      console.log("[Convex Auth] redirect callback called with:", redirectTo)

      // WORKAROUND: On mobile, the redirectTo cookie may not be preserved
      // through the OAuth flow due to cookie restrictions in in-app browsers.
      // If redirectTo is undefined/empty, default to the app's deep link scheme.
      if (!redirectTo) {
        // Default to the mobile app's deep link for OAuth callbacks
        const defaultRedirect = "shipnative://"
        console.log(
          "[Convex Auth] No redirectTo (cookie issue), using default:",
          defaultRedirect,
        )
        return defaultRedirect
      }

      // Allow Expo development URLs
      if (redirectTo.startsWith("exp://")) {
        console.log("[Convex Auth] Allowing Expo URL:", redirectTo)
        return redirectTo
      }
      // Allow custom app scheme (shipnative://)
      if (redirectTo.startsWith("shipnative://")) {
        console.log("[Convex Auth] Allowing shipnative:// URL:", redirectTo)
        return redirectTo
      }
      // Allow localhost for web development
      if (redirectTo.startsWith("http://localhost")) {
        console.log("[Convex Auth] Allowing localhost URL:", redirectTo)
        return redirectTo
      }
      // Allow 127.0.0.1 for local development
      if (redirectTo.startsWith("http://127.0.0.1")) {
        console.log("[Convex Auth] Allowing 127.0.0.1 URL:", redirectTo)
        return redirectTo
      }

      // For production, allow your app's domain
      // Add your production domain here when deploying
      console.log("[Convex Auth] Returning redirectTo as-is:", redirectTo)
      return redirectTo
    },
  },
})
