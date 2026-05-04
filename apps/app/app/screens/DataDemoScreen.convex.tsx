/**
 * DataDemoScreen - Convex Version
 *
 * This screen demonstrates proper data fetching patterns with Convex:
 * - Reactive queries that auto-update when data changes
 * - Type-safe mutations with automatic query invalidation
 * - Loading and error states
 *
 * Copy this pattern for your own data-fetching screens with Convex.
 *
 * KEY DIFFERENCE FROM SUPABASE:
 * - No manual refetching needed - queries are reactive!
 * - No React Query - Convex handles caching and updates
 * - Data updates in real-time across all clients
 */

import { FC, memo, useCallback, useState } from "react"
import { View, FlatList } from "react-native"
import { api } from "@convex/_generated/api"
import type { Doc, Id } from "@convex/_generated/dataModel"
import { Ionicons } from "@expo/vector-icons"
import { StyleSheet, useUnistyles } from "react-native-unistyles"

import { Text, Button, Card, TextField, Spinner, EmptyState, Screen } from "@/components"
import { useAuth } from "@/hooks"
import { useQuery, useMutation } from "@/hooks/convex"

// =============================================================================
// TYPES
// =============================================================================

// Pull the row type from the generated dataModel so the screen breaks at
// compile time if `posts` ever changes shape in `convex/schema.ts`.
type Post = Doc<"posts">

interface PostListItemProps {
  item: Post
  currentUserId: string | null
  onDelete: (postId: Id<"posts">) => void
  deleteColor: string
}

const PostListItem = memo(function PostListItem({
  item,
  currentUserId,
  onDelete,
  deleteColor,
}: PostListItemProps) {
  return (
    <Card
      style={styles.postCard}
      ContentComponent={
        <>
          <View style={styles.postHeader}>
            <Text preset="subheading" style={styles.postTitle}>
              {item.title}
            </Text>
            {item.authorId === currentUserId && (
              <Button
                variant="ghost"
                size="sm"
                onPress={() => onDelete(item._id)}
                LeftAccessory={() => (
                  <Ionicons name="trash-outline" size={16} color={deleteColor} />
                )}
              />
            )}
          </View>
          <Text style={styles.postContent}>{item.content}</Text>
          <Text preset="caption" style={styles.postDate}>
            {new Date(item._creationTime).toLocaleDateString()}
          </Text>
        </>
      }
    />
  )
})

// =============================================================================
// COMPONENT
// =============================================================================

export const DataDemoScreen: FC = () => {
  const { theme } = useUnistyles()
  const { userId } = useAuth()

  // Form state
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")

  // ============================================================
  // CONVEX DATA FETCHING
  // These queries are REACTIVE - they auto-update when data changes!
  // No manual refetching or invalidation needed.
  // ============================================================

  // Reactive query - auto-updates when posts table changes.
  // Function refs are typed, so a typo here is a TS error.
  const posts = useQuery(api.posts.list)

  // Mutations - auto-invalidate related queries
  const createPost = useMutation(api.posts.create)
  const deletePost = useMutation(api.posts.remove)

  // Loading state: undefined means loading
  const isLoading = posts === undefined

  const handleCreatePost = useCallback(async () => {
    if (!title.trim() || !content.trim()) return

    try {
      await createPost({ title, content })
      // No need to refetch! The useQuery hook auto-updates
      setTitle("")
      setContent("")
    } catch (err) {
      console.error("Failed to create post:", err)
    }
  }, [content, createPost, title])

  const handleDeletePost = useCallback(
    async (postId: Id<"posts">) => {
      try {
        await deletePost({ id: postId })
      } catch (err) {
        console.error("Failed to delete post:", err)
      }
    },
    [deletePost],
  )

  const keyExtractor = useCallback((item: Post) => item._id, [])

  const renderPost = useCallback(
    ({ item }: { item: Post }) => (
      <PostListItem
        item={item}
        currentUserId={userId ?? null}
        onDelete={handleDeletePost}
        deleteColor={theme.colors.error}
      />
    ),
    [handleDeletePost, theme.colors.error, userId],
  )

  if (isLoading) {
    return (
      <Screen preset="fixed" safeAreaEdges={["top", "bottom"]}>
        <View style={styles.centered}>
          <Spinner size="lg" />
          <Text style={styles.loadingText} tx="dataDemoScreen:loadingPosts" />
        </View>
      </Screen>
    )
  }

  return (
    <Screen preset="fixed" safeAreaEdges={["top", "bottom"]}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text preset="heading" tx="dataDemoScreen:convexTitle" />
          <Text preset="caption" style={styles.subtitle} tx="dataDemoScreen:convexSubtitle" />
        </View>

        {/* Create Post Form */}
        <Card
          style={styles.formCard}
          ContentComponent={
            <>
              <Text preset="subheading" style={styles.formTitle} tx="dataDemoScreen:formTitle" />
              <TextField
                placeholderTx="dataDemoScreen:titlePlaceholder"
                value={title}
                onChangeText={setTitle}
                style={styles.input}
              />
              <TextField
                placeholderTx="dataDemoScreen:contentPlaceholder"
                value={content}
                onChangeText={setContent}
                multiline
                numberOfLines={3}
                style={styles.input}
              />
              <Button
                tx="dataDemoScreen:createButton"
                variant="filled"
                onPress={handleCreatePost}
                disabled={!title.trim() || !content.trim()}
              />
            </>
          }
        />

        {/* Posts List - No RefreshControl needed! Data is reactive */}
        <FlatList
          data={posts}
          keyExtractor={keyExtractor}
          renderItem={renderPost}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <EmptyState
              icon="components"
              headingTx="dataDemoScreen:emptyHeading"
              contentTx="dataDemoScreen:emptyContent"
            />
          }
        />

        {/* Info card about reactivity */}
        <Card
          style={styles.infoCard}
          ContentComponent={
            <View style={styles.infoRow}>
              <Ionicons name="flash" size={20} color={theme.colors.primary} />
              <Text preset="caption" style={styles.infoText} tx="dataDemoScreen:realtimeInfo" />
            </View>
          }
        />
      </View>
    </Screen>
  )
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    padding: theme.spacing.md,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.xl,
  },
  header: {
    marginBottom: theme.spacing.lg,
  },
  subtitle: {
    color: theme.colors.foregroundSecondary,
    marginTop: theme.spacing.xs,
  },
  formCard: {
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  formTitle: {
    marginBottom: theme.spacing.md,
  },
  input: {
    marginBottom: theme.spacing.sm,
  },
  listContent: {
    paddingBottom: theme.spacing.xl,
  },
  postCard: {
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  postHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  postTitle: {
    flex: 1,
  },
  postContent: {
    color: theme.colors.foregroundSecondary,
    marginVertical: theme.spacing.sm,
  },
  postDate: {
    color: theme.colors.foregroundTertiary,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    color: theme.colors.foregroundSecondary,
  },
  infoCard: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.infoBackground,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  infoText: {
    flex: 1,
    color: theme.colors.primary,
  },
}))
