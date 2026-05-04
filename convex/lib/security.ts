/**
 * Security Helpers for Convex
 *
 * Provides RLS-like patterns at the function level.
 * Since Convex doesn't have database-level RLS like Supabase,
 * we enforce security in every function using these helpers.
 *
 * Usage:
 * ```ts
 * import { requireAuth, requireOwnership } from "./lib/security"
 *
 * export const myMutation = mutation({
 *   handler: async (ctx, args) => {
 *     const userId = await requireAuth(ctx)
 *     const post = await requireOwnership(ctx, "posts", args.postId, userId)
 *     // ... safe to proceed
 *   }
 * })
 * ```
 */

import { GenericQueryCtx, GenericMutationCtx } from "convex/server"
import { Id, TableNames } from "../_generated/dataModel"
import { auth } from "../auth"

// Type for contexts that support auth
type AuthContext = GenericQueryCtx<any> | GenericMutationCtx<any>

// Type for documents with userId field
type OwnedDocument = { userId: Id<"users">; [key: string]: any }

/**
 * Security error types for consistent error handling
 */
export class SecurityError extends Error {
  constructor(
    message: string,
    public code: "UNAUTHENTICATED" | "UNAUTHORIZED" | "NOT_FOUND" | "FORBIDDEN"
  ) {
    super(message)
    this.name = "SecurityError"
  }
}

/**
 * Require authentication - throws if user is not logged in
 *
 * @example
 * const userId = await requireAuth(ctx)
 */
export async function requireAuth(ctx: AuthContext): Promise<Id<"users">> {
  const userId = await auth.getUserId(ctx)
  if (!userId) {
    throw new SecurityError("Authentication required", "UNAUTHENTICATED")
  }
  return userId
}

/**
 * Get current user ID without throwing (returns null if not authenticated)
 *
 * @example
 * const userId = await getAuthUserId(ctx)
 * if (!userId) return [] // Return empty for unauthenticated
 */
export async function getAuthUserId(ctx: AuthContext): Promise<Id<"users"> | null> {
  return await auth.getUserId(ctx)
}

/**
 * Require ownership of a document - throws if user doesn't own it
 *
 * @example
 * const post = await requireOwnership(ctx, "posts", postId, userId, "authorId")
 */
export async function requireOwnership<T extends TableNames>(
  ctx: AuthContext,
  table: T,
  documentId: Id<T>,
  userId: Id<"users">,
  ownerField: string = "userId"
): Promise<OwnedDocument> {
  const document = await (ctx as GenericQueryCtx<any>).db.get(documentId)

  if (!document) {
    throw new SecurityError(`${table} not found`, "NOT_FOUND")
  }

  const ownerId = document[ownerField]
  if (!ownerId || ownerId !== userId) {
    throw new SecurityError(`Not authorized to access this ${table}`, "UNAUTHORIZED")
  }

  return document as OwnedDocument
}

/**
 * Check if user owns a document (doesn't throw, returns boolean)
 *
 * @example
 * if (await isOwner(ctx, "posts", postId, userId)) {
 *   // User owns this post
 * }
 */
export async function isOwner<T extends TableNames>(
  ctx: AuthContext,
  table: T,
  documentId: Id<T>,
  userId: Id<"users">,
  ownerField: string = "userId"
): Promise<boolean> {
  const document = await (ctx as GenericQueryCtx<any>).db.get(documentId)
  if (!document) return false

  const ownerId = document[ownerField]
  return ownerId === userId
}

/**
 * Require that the user has a specific role/permission
 * Useful for admin-only operations
 *
 * @example
 * await requireRole(ctx, userId, ["admin", "moderator"])
 */
export async function requireRole(
  ctx: AuthContext,
  userId: Id<"users">,
  allowedRoles: string[]
): Promise<void> {
  const user = await (ctx as GenericQueryCtx<any>).db.get(userId)

  if (!user) {
    throw new SecurityError("User not found", "NOT_FOUND")
  }

  const userRole = (user as any).role || "user"
  if (!allowedRoles.includes(userRole)) {
    throw new SecurityError(
      `Requires one of: ${allowedRoles.join(", ")}`,
      "FORBIDDEN"
    )
  }
}

/**
 * Require that the current authenticated user has the `admin` role.
 * Throws SecurityError if they're not signed in or not an admin.
 *
 * Use this at the top of any mutation that grants/revokes privileges,
 * touches other users' data, or otherwise needs to be admin-gated.
 *
 * @example
 * export const setUserRole = mutation({
 *   args: { userId: v.id("users"), role: v.string() },
 *   handler: async (ctx, args) => {
 *     await requireAdmin(ctx)
 *     await ctx.db.patch(args.userId, { role: args.role })
 *   },
 * })
 */
export async function requireAdmin(ctx: AuthContext): Promise<Id<"users">> {
  const userId = await requireAuth(ctx)
  await requireRole(ctx, userId, ["admin"])
  return userId
}

/**
 * Filter query results to only include the user's own documents.
 *
 * Uses the provided index (e.g. `"by_userId"` or `"by_authorId"`) so the
 * query is bounded by an index range instead of scanning the whole table.
 * The index's first field must be the owner field.
 *
 * @example
 * const myPosts = await filterByOwner(ctx, "posts", "by_authorId", userId, "authorId")
 * const myNotifs = await filterByOwner(ctx, "notifications", "by_userId", userId)
 */
export async function filterByOwner<T extends TableNames>(
  ctx: AuthContext,
  table: T,
  indexName: string,
  userId: Id<"users">,
  ownerField: string = "userId"
): Promise<any[]> {
  const results = await (ctx as GenericQueryCtx<any>).db
    .query(table)
    .withIndex(indexName as any, (q: any) => q.eq(ownerField, userId))
    .collect()

  return results
}

/**
 * Wrapper for creating secure queries that require authentication
 *
 * @example
 * export const myQuery = secureQuery({
 *   args: { ... },
 *   handler: async (ctx, args, userId) => {
 *     // userId is guaranteed to exist
 *   }
 * })
 */
export function withAuth<Args extends Record<string, any>, Result>(
  handler: (
    ctx: AuthContext,
    args: Args,
    userId: Id<"users">
  ) => Promise<Result>
): (ctx: AuthContext, args: Args) => Promise<Result> {
  return async (ctx: AuthContext, args: Args) => {
    const userId = await requireAuth(ctx)
    return handler(ctx, args, userId)
  }
}

/**
 * Audit log helper - record security-relevant actions
 *
 * @example
 * await auditLog(ctx, userId, "DELETE_ACCOUNT", { reason: "user_requested" })
 */
export async function auditLog(
  ctx: GenericMutationCtx<any>,
  userId: Id<"users"> | null,
  action: string,
  metadata?: Record<string, any>
): Promise<void> {
  // Log to console in development
  if (process.env.NODE_ENV === "development") {
    console.log(`[AUDIT] ${action}`, { userId, metadata, timestamp: new Date() })
  }

  // For production, you might want to:
  // 1. Write to an audit_logs table
  // 2. Send to external logging service
  // 3. Emit to analytics
}
