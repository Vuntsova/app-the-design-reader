/**
 * Widget Functions
 *
 * Functions for fetching data for native iOS/Android widgets.
 * Widgets need simple data access without complex auth flows.
 */

import { v } from "convex/values"
import { query, internalQuery } from "./_generated/server"
import { auth } from "./auth"

/**
 * Get current user profile for widget display
 * This is the main query for profile widgets
 */
export const getWidgetProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx)
    if (!userId) {
      return null
    }

    const user = await ctx.db.get(userId)
    if (!user) {
      return null
    }

    return {
      id: userId,
      name: user.name ?? null,
      email: user.email ?? null,
      avatarUrl: user.avatarUrl ?? user.image ?? null,
    }
  },
})

// Every case must scope by userId. New table cases must keep this invariant.
export const getData = query({
  args: {
    table: v.union(
      v.literal("users"),
      v.literal("posts"),
      v.literal("notifications"),
    ),
    limit: v.optional(v.number()),
    orderBy: v.optional(
      v.object({
        field: v.string(),
        order: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx)
    if (!userId) {
      return { data: null, error: "Not authenticated" }
    }

    const { table, limit = 10 } = args

    try {
      switch (table) {
        case "users": {
          const user = await ctx.db.get(userId)
          return {
            data: user
              ? {
                  id: userId,
                  name: user.name,
                  email: user.email,
                  avatarUrl: user.avatarUrl ?? user.image,
                  bio: user.bio,
                }
              : null,
            error: null,
          }
        }

        case "posts": {
          const posts = await ctx.db
            .query("posts")
            .withIndex("by_authorId", (q) => q.eq("authorId", userId))
            .order("desc")
            .take(limit)

          return { data: posts, error: null }
        }

        case "notifications": {
          const notifications = await ctx.db
            .query("notifications")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .order("desc")
            .take(limit)

          return { data: notifications, error: null }
        }

        default: {
          const _exhaustive: never = table
          return { data: null, error: `Unknown table: ${String(_exhaustive)}` }
        }
      }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  },
})

/**
 * Internal query for HTTP action to fetch widget data
 * Used by the widget HTTP endpoint
 */
export const getWidgetDataInternal = internalQuery({
  args: {
    userId: v.id("users"),
    table: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, table, limit = 10 } = args

    switch (table) {
      case "users":
      case "profiles": {
        const user = await ctx.db.get(userId)
        return user
          ? {
              id: userId,
              name: user.name,
              email: user.email,
              avatarUrl: user.avatarUrl ?? user.image,
            }
          : null
      }

      case "posts": {
        return await ctx.db
          .query("posts")
          .withIndex("by_authorId", (q) => q.eq("authorId", userId))
          .order("desc")
          .take(limit)
      }

      case "notifications": {
        return await ctx.db
          .query("notifications")
          .withIndex("by_userId", (q) => q.eq("userId", userId))
          .order("desc")
          .take(limit)
      }

      default:
        return null
    }
  },
})
