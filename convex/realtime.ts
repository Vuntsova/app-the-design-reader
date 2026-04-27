/**
 * Realtime Functions for Convex
 *
 * Provides presence tracking and broadcast messaging similar to Supabase Realtime.
 *
 * Convex queries are reactive by default, but for presence and broadcast
 * we need explicit tracking via database tables.
 *
 * Features:
 * - Presence: Track which users are online in a channel
 * - Broadcast: Send ephemeral messages to channel subscribers
 */

import { v } from "convex/values"
import { query, mutation, internalMutation } from "./_generated/server"
import { Id } from "./_generated/dataModel"
import { requireAuth } from "./lib/security"

// ============================================================================
// Presence Functions
// ============================================================================

/**
 * Join a presence channel (mark user as present)
 *
 * @example
 * const { presenceId } = await ctx.runMutation(api.realtime.joinPresence, {
 *   channel: "room:123",
 *   state: { status: "online", cursor: { x: 100, y: 200 } }
 * })
 */
export const joinPresence = mutation({
  args: {
    channel: v.string(),
    state: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx)

    // Remove any existing presence for this user in this channel
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_channel_user", (q) =>
        q.eq("channel", args.channel).eq("userId", userId)
      )
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        state: args.state,
        lastSeenAt: Date.now(),
      })
      return { presenceId: existing._id, isNew: false }
    }

    // Create new presence record
    const presenceId = await ctx.db.insert("presence", {
      channel: args.channel,
      userId,
      state: args.state,
      joinedAt: Date.now(),
      lastSeenAt: Date.now(),
    })

    return { presenceId, isNew: true }
  },
})

/**
 * Update presence state (heartbeat + state update)
 */
export const updatePresence = mutation({
  args: {
    channel: v.string(),
    state: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx)

    const existing = await ctx.db
      .query("presence")
      .withIndex("by_channel_user", (q) =>
        q.eq("channel", args.channel).eq("userId", userId)
      )
      .first()

    if (!existing) {
      // Auto-join if not present
      const presenceId = await ctx.db.insert("presence", {
        channel: args.channel,
        userId,
        state: args.state,
        joinedAt: Date.now(),
        lastSeenAt: Date.now(),
      })
      return { presenceId, isNew: true }
    }

    await ctx.db.patch(existing._id, {
      state: args.state ?? existing.state,
      lastSeenAt: Date.now(),
    })

    return { presenceId: existing._id }
  },
})

/**
 * Leave a presence channel
 */
export const leavePresence = mutation({
  args: {
    channel: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx)

    const existing = await ctx.db
      .query("presence")
      .withIndex("by_channel_user", (q) =>
        q.eq("channel", args.channel).eq("userId", userId)
      )
      .first()

    if (existing) {
      await ctx.db.delete(existing._id)
      return { success: true }
    }

    return { success: false, message: "Not in channel" }
  },
})

/**
 * Get all users present in a channel (reactive query)
 *
 * This query automatically updates when users join/leave!
 */
export const getPresence = query({
  args: {
    channel: v.string(),
    includeStale: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const staleThreshold = 30000 // 30 seconds
    const now = Date.now()

    const presenceRecords = await ctx.db
      .query("presence")
      .withIndex("by_channel", (q) => q.eq("channel", args.channel))
      .collect()

    // Filter out stale records unless includeStale is true
    const activeRecords = args.includeStale
      ? presenceRecords
      : presenceRecords.filter((p) => now - p.lastSeenAt < staleThreshold)

    // Get user details for each presence
    const presenceWithUsers = await Promise.all(
      activeRecords.map(async (p) => {
        const user = await ctx.db.get(p.userId)
        return {
          presenceId: p._id,
          userId: p.userId,
          state: p.state,
          joinedAt: p.joinedAt,
          lastSeenAt: p.lastSeenAt,
          user: user
            ? {
                id: user._id,
                name: user.name,
                email: user.email,
                avatarUrl: user.avatarUrl,
              }
            : null,
        }
      })
    )

    return {
      channel: args.channel,
      count: presenceWithUsers.length,
      users: presenceWithUsers,
    }
  },
})

/**
 * Clean up stale presence records (run periodically via cron)
 */
export const cleanupStalePresence = internalMutation({
  args: {
    maxAgeMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const maxAge = args.maxAgeMs ?? 60000 // Default 1 minute
    const threshold = Date.now() - maxAge

    const staleRecords = await ctx.db
      .query("presence")
      .filter((q) => q.lt(q.field("lastSeenAt"), threshold))
      .collect()

    for (const record of staleRecords) {
      await ctx.db.delete(record._id)
    }

    return { cleaned: staleRecords.length }
  },
})

// ============================================================================
// Broadcast Functions
// ============================================================================

/**
 * Send a broadcast message to a channel
 *
 * Messages are stored temporarily and auto-deleted after TTL.
 *
 * @example
 * await ctx.runMutation(api.realtime.broadcast, {
 *   channel: "room:123",
 *   event: "cursor_move",
 *   payload: { x: 100, y: 200 }
 * })
 */
export const broadcast = mutation({
  args: {
    channel: v.string(),
    event: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx)

    const messageId = await ctx.db.insert("broadcasts", {
      channel: args.channel,
      event: args.event,
      payload: args.payload,
      senderId: userId,
      createdAt: Date.now(),
      expiresAt: Date.now() + 30000, // 30 second TTL
    })

    return { messageId }
  },
})

/**
 * Subscribe to broadcast messages (reactive query)
 *
 * Returns recent messages in the channel. Use with useQuery for real-time updates.
 *
 * @example
 * const messages = useQuery(api.realtime.subscribeBroadcast, {
 *   channel: "room:123",
 *   since: lastSeenTimestamp
 * })
 */
export const subscribeBroadcast = query({
  args: {
    channel: v.string(),
    since: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const since = args.since ?? Date.now() - 30000 // Default last 30 seconds
    const limit = args.limit ?? 100

    const messages = await ctx.db
      .query("broadcasts")
      .withIndex("by_channel_created", (q) =>
        q.eq("channel", args.channel).gt("createdAt", since)
      )
      .order("desc")
      .take(limit)

    return {
      channel: args.channel,
      messages: messages.map((m) => ({
        id: m._id,
        event: m.event,
        payload: m.payload,
        senderId: m.senderId,
        createdAt: m.createdAt,
      })),
    }
  },
})

/**
 * Clean up expired broadcast messages (run periodically via cron)
 */
export const cleanupExpiredBroadcasts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()

    const expired = await ctx.db
      .query("broadcasts")
      .filter((q) => q.lt(q.field("expiresAt"), now))
      .collect()

    for (const msg of expired) {
      await ctx.db.delete(msg._id)
    }

    return { cleaned: expired.length }
  },
})
