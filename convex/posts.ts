/**
 * Post Queries and Mutations
 *
 * Powers the canonical "copy this pattern" data-fetching demo
 * (`DataDemoScreen.convex.tsx`). Mirrors the auth/scoping patterns from
 * `users.ts`: every entry point goes through `requireAuth` and reads/writes
 * are scoped to the caller via the `by_authorId` index.
 */

import { ConvexError, v } from "convex/values"
import { query, mutation } from "./_generated/server"
import { requireAuth, requireOwnership } from "./lib/security"

/**
 * List the current user's posts, newest first.
 *
 * Reactive: any insert/delete on `posts` for this user re-runs this query
 * on subscribed clients. Indexed via `by_authorId` so we never scan the
 * whole table.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx)

    const posts = await ctx.db
      .query("posts")
      .withIndex("by_authorId", (q) => q.eq("authorId", userId))
      .order("desc")
      .take(20)

    return posts
  },
})

/**
 * Create a new post owned by the current user.
 *
 * `authorId` is taken from the authenticated session, never from the
 * client. `status` defaults to "published" so the demo screen can show
 * results immediately without exposing draft/publish UI.
 */
export const create = mutation({
  args: {
    title: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx)

    const title = args.title.trim()
    const content = args.content.trim()
    if (!title || !content) {
      throw new ConvexError("Title and content are required")
    }

    const postId = await ctx.db.insert("posts", {
      authorId: userId,
      title,
      content,
      status: "published",
      createdAt: Date.now(),
    })

    return await ctx.db.get(postId)
  },
})

/**
 * Delete a post the current user owns.
 *
 * `requireOwnership` verifies the post exists and that `authorId` matches
 * the caller. Anyone trying to delete someone else's post hits a
 * SecurityError before we touch the row.
 */
export const remove = mutation({
  args: {
    id: v.id("posts"),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx)
    await requireOwnership(ctx, "posts", args.id, userId, "authorId")

    await ctx.db.delete(args.id)
    return { success: true }
  },
})
