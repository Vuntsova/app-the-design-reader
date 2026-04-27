/**
 * Convex Database Service
 *
 * `backend.db` is Supabase-only. On Convex, every method on this service
 * throws at runtime (except in mock mode, which is preserved for local
 * development). For Convex queries and mutations, import the generated
 * client from `convex/_generated/api` and call `useQuery` / `useMutation`
 * from `convex/react` directly. See `vibe/BACKEND.md` for the pattern.
 *
 * Mock mode (no Convex credentials configured) still implements the full
 * in-memory CRUD surface so existing tests and dev flows keep working.
 */

import type { DatabaseService, DatabaseResult, QueryFilter, QueryOptions } from "../types"
import { isUsingMockConvex } from "./client"

const SUPABASE_ONLY_MESSAGE =
  "backend.db is Supabase-only. On Convex, import generated client from 'convex/_generated/api' and use useQuery/useMutation directly. See vibe/BACKEND.md for the pattern."

// ============================================================================
// Mock Data Store (for development without Convex credentials)
// ============================================================================

const mockDataStore: Map<string, Map<string, Record<string, unknown>>> = new Map()

function getMockTable(table: string): Map<string, Record<string, unknown>> {
  if (!mockDataStore.has(table)) {
    mockDataStore.set(table, new Map())
  }
  return mockDataStore.get(table)!
}

function generateMockId(): string {
  return `mock_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

// ============================================================================
// Filter Helpers
// ============================================================================

function matchesFilter(record: Record<string, unknown>, filter: QueryFilter): boolean {
  const value = record[filter.column]

  switch (filter.operator) {
    case "eq":
      return value === filter.value
    case "neq":
      return value !== filter.value
    case "gt":
      return typeof value === "number" && typeof filter.value === "number" && value > filter.value
    case "gte":
      return typeof value === "number" && typeof filter.value === "number" && value >= filter.value
    case "lt":
      return typeof value === "number" && typeof filter.value === "number" && value < filter.value
    case "lte":
      return typeof value === "number" && typeof filter.value === "number" && value <= filter.value
    case "like":
      return (
        typeof value === "string" &&
        typeof filter.value === "string" &&
        value.includes(filter.value.replace(/%/g, ""))
      )
    case "ilike":
      return (
        typeof value === "string" &&
        typeof filter.value === "string" &&
        value.toLowerCase().includes(filter.value.toLowerCase().replace(/%/g, ""))
      )
    case "in":
      return Array.isArray(filter.value) && filter.value.includes(value)
    case "contains":
      return (
        Array.isArray(value) &&
        Array.isArray(filter.value) &&
        filter.value.every((v) => value.includes(v))
      )
    default:
      return true
  }
}

function matchesAllFilters(record: Record<string, unknown>, filters: QueryFilter[]): boolean {
  return filters.every((filter) => matchesFilter(record, filter))
}

// ============================================================================
// Convex Database Service Implementation
// ============================================================================

/**
 * Create a Convex Database service instance.
 *
 * IMPORTANT: Convex doesn't support direct database queries from the client.
 * Instead, you should:
 *
 * 1. Define queries/mutations in your `convex/` folder
 * 2. Use `useQuery(api.tableName.list)` and `useMutation(api.tableName.create)`
 *
 * This service provides a compatibility layer for simple CRUD operations,
 * but it requires corresponding Convex functions to be defined.
 *
 * Example Convex functions needed:
 * ```typescript
 * // convex/users.ts
 * export const list = query({
 *   args: { filters: v.optional(v.array(v.object({...}))) },
 *   handler: async (ctx, args) => { ... }
 * })
 *
 * export const get = query({
 *   args: { id: v.id("users") },
 *   handler: async (ctx, args) => { ... }
 * })
 *
 * export const create = mutation({
 *   args: { data: v.object({...}) },
 *   handler: async (ctx, args) => { ... }
 * })
 * ```
 */
export function createConvexDatabaseService(): DatabaseService {
  return {
    async query<T = unknown>(table: string, options?: QueryOptions): Promise<DatabaseResult<T[]>> {
      if (!isUsingMockConvex) {
        throw new Error(SUPABASE_ONLY_MESSAGE)
      }
      try {
        // Mock implementation
        const mockTable = getMockTable(table)
        let results = Array.from(mockTable.values())

        // Apply filters
        if (options?.filters) {
          results = results.filter((record) => matchesAllFilters(record, options.filters!))
        }

        // Apply ordering
        if (options?.orderBy && options.orderBy.length > 0) {
          results.sort((a, b) => {
            for (const order of options.orderBy!) {
              const aVal = a[order.column] as unknown
              const bVal = b[order.column] as unknown
              if ((aVal as number) < (bVal as number)) return order.ascending !== false ? -1 : 1
              if ((aVal as number) > (bVal as number)) return order.ascending !== false ? 1 : -1
            }
            return 0
          })
        }

        // Apply pagination
        const offset = options?.offset ?? 0
        const limit = options?.limit ?? results.length
        results = results.slice(offset, offset + limit)

        return {
          data: results as T[],
          error: null,
          count: results.length,
        }
      } catch (error) {
        return {
          data: null,
          error: { name: "DatabaseError", message: (error as Error).message },
        }
      }
    },

    async get<T = unknown>(
      table: string,
      id: string,
      _options?: { select?: string },
    ): Promise<DatabaseResult<T>> {
      if (!isUsingMockConvex) {
        throw new Error(SUPABASE_ONLY_MESSAGE)
      }
      try {
        const mockTable = getMockTable(table)
        const record = mockTable.get(id)
        return {
          data: (record as T) ?? null,
          error: record ? null : { name: "DatabaseError", message: "Record not found" },
        }
      } catch (error) {
        return {
          data: null,
          error: { name: "DatabaseError", message: (error as Error).message },
        }
      }
    },

    async insert<T = unknown>(
      table: string,
      data: Partial<T> | Partial<T>[],
      _options?: { returning?: boolean },
    ): Promise<DatabaseResult<T>> {
      if (!isUsingMockConvex) {
        throw new Error(SUPABASE_ONLY_MESSAGE)
      }
      try {
        const mockTable = getMockTable(table)
        const records = Array.isArray(data) ? data : [data]
        const inserted: Record<string, unknown>[] = []

        for (const record of records) {
          const id = generateMockId()
          const newRecord = {
            _id: id,
            _creationTime: Date.now(),
            ...record,
          }
          mockTable.set(id, newRecord)
          inserted.push(newRecord)
        }

        return {
          data: (Array.isArray(data) ? inserted : inserted[0]) as T,
          error: null,
        }
      } catch (error) {
        return {
          data: null,
          error: { name: "DatabaseError", message: (error as Error).message },
        }
      }
    },

    async update<T = unknown>(
      table: string,
      data: Partial<T>,
      filters: QueryFilter[],
    ): Promise<DatabaseResult<T>> {
      if (!isUsingMockConvex) {
        throw new Error(SUPABASE_ONLY_MESSAGE)
      }
      try {
        const mockTable = getMockTable(table)
        let updated: Record<string, unknown> | null = null

        for (const [id, record] of mockTable) {
          if (matchesAllFilters(record, filters)) {
            const updatedRecord = { ...record, ...data }
            mockTable.set(id, updatedRecord)
            updated = updatedRecord
            break // Update first matching record
          }
        }

        return {
          data: updated as T,
          error: updated ? null : { name: "DatabaseError", message: "No matching record found" },
        }
      } catch (error) {
        return {
          data: null,
          error: { name: "DatabaseError", message: (error as Error).message },
        }
      }
    },

    async delete<T = unknown>(table: string, filters: QueryFilter[]): Promise<DatabaseResult<T>> {
      if (!isUsingMockConvex) {
        throw new Error(SUPABASE_ONLY_MESSAGE)
      }
      try {
        const mockTable = getMockTable(table)
        let deleted: Record<string, unknown> | null = null

        for (const [id, record] of mockTable) {
          if (matchesAllFilters(record, filters)) {
            deleted = record
            mockTable.delete(id)
            break // Delete first matching record
          }
        }

        return {
          data: deleted as T,
          error: deleted ? null : { name: "DatabaseError", message: "No matching record found" },
        }
      } catch (error) {
        return {
          data: null,
          error: { name: "DatabaseError", message: (error as Error).message },
        }
      }
    },

    async upsert<T = unknown>(
      table: string,
      data: Partial<T> | Partial<T>[],
      options?: { onConflict?: string; returning?: boolean },
    ): Promise<DatabaseResult<T>> {
      if (!isUsingMockConvex) {
        throw new Error(SUPABASE_ONLY_MESSAGE)
      }
      try {
        const mockTable = getMockTable(table)
        const records = Array.isArray(data) ? data : [data]
        const upserted: Record<string, unknown>[] = []
        const conflictKey = options?.onConflict ?? "_id"

        for (const record of records) {
          const conflictValue = (record as Record<string, unknown>)[conflictKey]
          let existingId: string | null = null

          // Find existing record by conflict key
          if (conflictValue) {
            for (const [id, existing] of mockTable) {
              if (existing[conflictKey] === conflictValue) {
                existingId = id
                break
              }
            }
          }

          if (existingId) {
            // Update existing
            const existing = mockTable.get(existingId)!
            const updated = { ...existing, ...record }
            mockTable.set(existingId, updated)
            upserted.push(updated)
          } else {
            // Insert new
            const id = generateMockId()
            const newRecord = {
              _id: id,
              _creationTime: Date.now(),
              ...record,
            }
            mockTable.set(id, newRecord)
            upserted.push(newRecord)
          }
        }

        return {
          data: (Array.isArray(data) ? upserted : upserted[0]) as T,
          error: null,
        }
      } catch (error) {
        return {
          data: null,
          error: { name: "DatabaseError", message: (error as Error).message },
        }
      }
    },

    async rpc<T = unknown>(
      functionName: string,
      params?: Record<string, unknown>,
    ): Promise<DatabaseResult<T>> {
      if (!isUsingMockConvex) {
        throw new Error(SUPABASE_ONLY_MESSAGE)
      }
      try {
        // Mock RPC: log and return null
        void functionName
        void params
        return { data: null, error: null }
      } catch (error) {
        return {
          data: null,
          error: { name: "DatabaseError", message: (error as Error).message },
        }
      }
    },
  }
}

// ============================================================================
// Mock Data Utilities (for testing)
// ============================================================================

export const convexMockDb = {
  /**
   * Clear all mock data
   */
  clear(): void {
    mockDataStore.clear()
  },

  /**
   * Seed a table with mock data
   */
  seed(table: string, records: Record<string, unknown>[]): void {
    const mockTable = getMockTable(table)
    for (const record of records) {
      const id = (record._id as string) ?? generateMockId()
      mockTable.set(id, {
        _id: id,
        _creationTime: Date.now(),
        ...record,
      })
    }
  },

  /**
   * Get all records from a table
   */
  getAll(table: string): Record<string, unknown>[] {
    const mockTable = getMockTable(table)
    return Array.from(mockTable.values())
  },
}
